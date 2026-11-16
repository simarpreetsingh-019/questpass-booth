/**
 * <questpass-booth>: the photo booth and video maker, on the phone.
 *
 *   <questpass-booth config-src="/booth.json"></questpass-booth>
 *
 * Photos never leave the device: the camera feed and the shots stay in
 * memory, and are gone when the page closes. The host page hears about
 * finished photos and videos through events (questpass:photo,
 * questpass:video) and decides what, if anything, to do with them.
 *
 * Camera privacy: it stops as soon as a shot is taken, when the page is
 * hidden or left, when the element is removed, and `camera.idleSeconds`
 * after it's opened, whatever is going on; "Turn off" stops it any time.
 */
import { offeredFrames, shareTextOf, type BoothConfig } from "../core/config";
import { frameMeta, listFrames, photosFor, type FrameMeta } from "../core/frames-meta";
import { createPreviewer, framePalettes, listTracks, makeVideo, renderPhoto, toBitmap, type FrameId, type PaletteChoice, type Ratio } from "../core/render";
import { samplePhotos } from "../core/samples";
import { listWordSlots } from "../core/config";
import { CREDIT_LINE } from "../core/brand";
import { VERSION } from "../core/version";
import { append, applyTheme, clear, download, emit, h, readConfig, shareFile, slug } from "./dom";
import { adoptStyles } from "./styles";
import { CLIP_MAX_SEC, ClipSource, makeClipVideo, type ClipSound } from "../core/clip";
import { REEL_CLIP_MAX_SEC } from "../core/render";
import { NETWORKS, cleanHandle, type Network } from "../core/handle";

const SIZES: Array<[Ratio, string]> = [
  ["9:16", "Story"],
  ["4:5", "Post"],
  ["1:1", "Square"],
  ["16:9", "Wide"],
];
const VIEW_W = 540;
const ALL = "All";

/** A base64 data URL as a Blob (without fetch, so a strict connect-src doesn't block it). */
function dataUrlBlob(url: string): Blob {
  const [head, b64 = ""] = url.split(",", 2);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: /^data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/jpeg" });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Shot {
  image: ImageBitmap;
  thumb: string;
}

/** Thumbnails of frames draw one at a time, so the page stays smooth. */
let thumbQueue: Promise<void> = Promise.resolve();
const queue = (job: () => void | Promise<void>) => {
  thumbQueue = thumbQueue.then(() => new Promise<void>((res) => setTimeout(async () => {
    try {
      await job();
    } catch {
      // a thumbnail that fails stays blank
    }
    res();
  }, 30)));
};

export class BoothElement extends HTMLElement {
  static get observedAttributes() {
    return ["config", "config-src", "person-name", "person-line", "person-handle", "avatar-endpoint"];
  }

  private root: ShadowRoot;
  private cfg!: BoothConfig;
  private configProp: unknown = undefined;
  private shots: Shot[] = [];
  private samples: ImageBitmap[] = [];
  private frame: FrameId = "polaroid";
  /** photos, or a video clip played inside the frame */
  private mode: "photo" | "clip" = "photo";
  private clip: ClipSource | null = null;
  private clipStart = 0;
  private clipLen = 15;
  private clipSound: ClipSound = "both";
  private clipTrack = "";
  private clipPlaying = false;
  private clipRaf = 0;
  private recorder: MediaRecorder | null = null;
  private recordTimer = 0;
  private recordLeft = 0;
  /** the recap video's photos and clips, in order */
  private reel: Array<{ kind: "photo"; shot: Shot } | { kind: "clip"; clip: ClipSource; start: number; length: number; thumb: string }> = [];
  private reelClipSound = true;
  private modeBar = h("div", { class: "row center", role: "tablist", "aria-label": "Photo or video" });
  private group = "";
  private ratio: Ratio = "4:5";
  private palette: PaletteChoice = "brand";
  private caption = "";
  private name = "";
  private typed: Record<string, string> = {};
  private hd = true;
  private stream: MediaStream | null = null;
  private facing: "user" | "environment" = "user";
  private cameraTurn = 0;
  private idleTimer = 0;
  private raf = 0;
  private busy = false;
  private view = h("canvas", { "aria-label": "Your photo in the frame", role: "img" });
  private feed = h("video", { class: "feed", playsInline: true, muted: true, autoplay: true });
  private grab = document.createElement("canvas");
  private countEl = h("div", { class: "count", "aria-live": "assertive" });
  private flashEl = h("div", { class: "flash" });
  private controls = h("div", { class: "row center" });
  private panel = h("div", { style: { display: "grid", gap: "14px" } });
  private statusEl = h("p", { class: "status", role: "status", "aria-live": "polite" });
  private videoUrl = "";
  private previewer: Awaited<ReturnType<typeof createPreviewer>> | null = null;
  private renderSeq = 0;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    adoptStyles(this.root);
  }

  /** The booth's settings (any JSON; checked and completed). Setting it redraws the booth. */
  get config(): BoothConfig | undefined {
    return this.cfg;
  }
  set config(v: unknown) {
    this.configProp = v;
    void this.load();
  }

  connectedCallback() {
    void this.load();
    document.addEventListener("visibilitychange", this.onHidden);
    window.addEventListener("pagehide", this.stopCamera);
  }

  disconnectedCallback() {
    this.stopCamera();
    this.pauseClip();
    document.removeEventListener("visibilitychange", this.onHidden);
    window.removeEventListener("pagehide", this.stopCamera);
  }

  attributeChangedCallback(name: string, old: string | null, now: string | null) {
    if (name === "avatar-endpoint") {
      if (this.cfg) this.renderPanel();
      return;
    }
    if (name === "person-name" || name === "person-line" || name === "person-handle") {
      this.person = { name: this.getAttribute("person-name") ?? undefined, line: this.getAttribute("person-line") ?? undefined, handle: this.getAttribute("person-handle") ?? undefined };
      return;
    }
    // the first values are read by connectedCallback; only later changes reload
    if (this.loaded && old !== now && this.configProp === undefined) void this.load();
  }

  /**
   * The person in the photo, filled in by the host page (e.g. from its
   * Discord login: their mafia name, a line, their NFT as the picture on
   * frames that show one). They can still change the name and line.
   * avatar: an image URL (allowing CORS), Blob or ImageBitmap.
   */
  set person(p: { name?: string; line?: string; avatar?: string | Blob | ImageBitmap | null; handle?: string; network?: Network }) {
    if (typeof p.name === "string") this.name = p.name.slice(0, 40);
    if (typeof p.handle === "string") this.handle = { network: p.network ?? this.handle.network, username: cleanHandle(p.handle) };
    if (typeof p.line === "string") this.caption = p.line.slice(0, 60);
    if (p.avatar !== undefined) void this.setAvatar(p.avatar);
    if (this.cfg) {
      this.renderPanel();
      void this.redraw();
    }
  }
  get person() {
    return { name: this.name, line: this.caption, handle: this.handle.username, network: this.handle.network };
  }

  private avatar: ImageBitmap | null = null;

  private async setAvatar(src: string | Blob | ImageBitmap | null) {
    try {
      if (!src) this.avatar = null;
      else if (typeof src === "string") {
        const r = await fetch(src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
        if (!r.ok || !/^image\//.test(r.headers.get("content-type") ?? "")) throw new Error();
        this.avatar = await toBitmap(await r.blob(), 1024);
      } else this.avatar = await toBitmap(src, 1024);
    } catch {
      this.avatar = null;
      this.status("The profile picture couldn't be loaded.", true);
    }
    if (this.cfg) void this.redraw();
  }

  private onHidden = () => {
    if (document.hidden) this.stopCamera();
  };

  private loaded = false;

  private async load() {
    this.loaded = true;
    this.cfg = await readConfig(this, this.configProp);
    applyTheme(this, this.cfg);
    const offered = offeredFrames(this.cfg);
    if (!offered.includes(this.frame) || !this.previewer) {
      this.frame = this.cfg.frames.default;
      this.ratio = frameMeta(this.frame).ratio;
    }
    if (!this.samples.length) this.samples = await samplePhotos().catch(() => []);
    this.build();
    await this.redraw();
    emit(this, "questpass:ready", { version: VERSION });
  }

  private status(msg: string, err = false) {
    this.statusEl.textContent = msg;
    this.statusEl.className = err ? "status err" : "status";
    if (err) emit(this, "questpass:error", { message: msg });
  }

  /* ------------------------------------------------------------ layout */

  private build() {
    clear(this.root);
    adoptStyles(this.root);
    const c = this.cfg;
    const logo = c.brand.logo ? h("img", { src: c.brand.logo, alt: c.brand.name || "", referrerpolicy: "no-referrer" }) : null;
    const sub = [c.place, c.dates].filter(Boolean).join(" · ");
    append(this.root, [
      h(
        "div",
        { class: "wrap", part: "booth" },
        h("div", { class: "head" }, logo, h("div", null, h("h2", null, c.title), sub ? h("div", { class: "sub" }, sub) : null)),
        this.modeBar,
        h("div", { class: "stage" }, this.view, this.feed, this.countEl, this.flashEl),
        this.controls,
        this.statusEl,
        this.panel,
        h("p", { class: "credit" }, "Made with ", h("a", { href: "https://github.com/simarpreetsingh-019/questpass-booth", target: "_blank", rel: "noopener noreferrer" }, "QuestPass Booth"), " by ", h("a", { href: "https://x.com/simarpreet_019", target: "_blank", rel: "noopener noreferrer" }, "@simarpreet_019")),
      ),
    ]);
    this.renderModeBar();
    this.renderControls();
    this.renderPanel();
  }

  /** 📸 Photo | 🎥 Video (only when the booth makes videos). */
  private renderModeBar() {
    clear(this.modeBar);
    if (!this.cfg.video.enabled) return;
    for (const [m, label] of [["photo", "📸 Photo"], ["clip", "🎥 Video"]] as const) {
      this.modeBar.appendChild(
        h("button", { class: "small", role: "tab", "aria-selected": String(this.mode === m), style: this.mode === m ? { borderColor: "var(--qp-accent)", background: "color-mix(in srgb, var(--qp-accent) 18%, transparent)" } : {}, onclick: () => this.setMode(m) }, label),
      );
    }
  }

  private setMode(m: "photo" | "clip") {
    if (m === this.mode) return;
    this.stopCamera();
    this.pauseClip();
    this.mode = m;
    this.renderModeBar();
    this.renderControls();
    this.renderPanel();
    void this.redraw();
  }

  private live() {
    return this.stream !== null;
  }

  private renderControls() {
    clear(this.controls);
    if (this.mode === "clip") return this.renderClipControls();
    const pick = this.fileButton(this.shots.length ? "＋ Add photos" : "🖼️ Choose photos");
    if (this.live()) {
      const left = Math.max(0, this.cfg.camera.idleSeconds);
      append(this.controls, [
        h("button", { class: "small", onclick: () => void this.flip(), "aria-label": "Switch camera" }, "🔄 Flip"),
        h("button", { class: "shutter", onclick: () => void this.shoot(), disabled: this.busy, "aria-label": "Take the photo" }),
        h("button", { class: "small", onclick: this.stopCamera, "aria-label": "Turn the camera off" }, "Camera on · Turn off"),
        h("p", { class: "note wide", style: { textAlign: "center" } }, `The camera turns itself off ${left} seconds after it opens.`),
      ]);
      return;
    }
    append(this.controls, [
      h("button", { class: "primary big", onclick: () => void this.startCamera() }, this.shots.length ? "📷 Retake" : "📷 Open camera"),
      pick,
      !this.shots.length ? h("p", { class: "note wide", style: { textAlign: "center" } }, "Your photos stay on your phone. Nothing is uploaded.") : null,
    ]);
  }

  private fileButton(label: string) {
    const input = h("input", { type: "file", accept: "image/*", multiple: true, style: { display: "none" } });
    input.addEventListener("change", () => {
      void this.addFiles(input.files).then(() => (input.value = ""));
    });
    return h("label", { class: "btn" }, label, input);
  }

  private renderPanel() {
    clear(this.panel);
    const c = this.cfg;
    const metas = new Map(listFrames().map((f) => [f.id, f]));
    const frames = offeredFrames(c).map((id) => metas.get(id)).filter((f): f is FrameMeta => Boolean(f));
    // frames
    // frames by group (Pizza frames, Fun, Clean…), in the order the booth lists them, plus All
    const groups = [...new Set(frames.map((f) => f.group))];
    if (this.group !== ALL && !groups.includes(this.group)) this.group = frames.find((f) => f.id === this.frame)?.group ?? groups[0] ?? ALL;
    const tabs = h("div", { class: "row scroll", role: "tablist", "aria-label": "Frame groups" });
    for (const g of groups.length > 1 ? [...groups, ALL] : []) {
      tabs.appendChild(h("button", { class: "small", role: "tab", "aria-selected": String(this.group === g), style: this.group === g ? { borderColor: "var(--qp-accent)", background: "color-mix(in srgb, var(--qp-accent) 18%, transparent)" } : {}, onclick: () => {
        this.group = g;
        this.renderPanel();
      } }, g === ALL ? `All (${frames.length})` : `${g === "Pizza frames" ? "🍕 " : ""}${g} (${frames.filter((f) => f.group === g).length})`));
    }
    const strip = h("div", { class: "row scroll", role: "group", "aria-label": "Frames" });
    for (const f of frames.filter((f) => this.group === ALL || f.group === this.group)) strip.appendChild(this.frameChip(f));
    // colours
    const swatches = h("div", { class: "row scroll", role: "group", "aria-label": "Colours" });
    const sw = (choice: PaletteChoice, color: string, label: string) =>
      h("button", { class: "swatch", style: { background: color }, title: label, "aria-label": label, "aria-pressed": String(this.palette === choice), onclick: () => this.set({ palette: choice }) });
    swatches.appendChild(sw("brand", c.brand.colors.accent, `${c.brand.name || "Brand"} colours`));
    if (this.shots.length || this.clip) swatches.appendChild(h("button", { class: "swatch", style: { background: "conic-gradient(#f66,#fc6,#6f9,#6cf,#c6f,#f66)" }, title: "From my photo", "aria-label": "Colours from my photo", "aria-pressed": String(this.palette === "photo"), onclick: () => this.set({ palette: "photo" }) }));
    for (const p of framePalettes(this.frame)) swatches.appendChild(sw(p.index, p.accent, p.name));
    // size
    const sizes = h("div", { class: "row", role: "group", "aria-label": "Size" });
    for (const [r, label] of SIZES) {
      sizes.appendChild(h("button", { class: "small", "aria-pressed": String(this.ratio === r), style: this.ratio === r ? { borderColor: "var(--qp-accent)" } : {}, onclick: () => this.set({ ratio: r }) }, label));
    }
    // words
    const fields = h("div", { style: { display: "grid", gap: "10px" } });
    fields.appendChild(this.nameField());
    if (c.person.handle.ask) fields.appendChild(this.handleField());
    if (c.person.picture) fields.appendChild(this.pictureField());
    fields.appendChild(this.text(c.person.lineLabel, this.caption, 60, (v) => (this.caption = v), "A line under the photo (optional)"));
    for (const s of listWordSlots().filter((s) => s.frame === this.frame)) {
      const own = c.words[s.id];
      if ((own?.mode ?? s.defaultMode) !== "edit") continue;
      fields.appendChild(this.text(s.label, this.typed[s.id] ?? own?.text ?? "", s.max, (v) => (this.typed[s.id] = v), s.placeholder));
    }
    const thumbs = h("div", { class: "thumbs", "aria-label": "Your photos" });
    this.shots.forEach((s, i) =>
      thumbs.appendChild(
        h("div", { class: "thumb" }, h("img", { src: s.thumb, alt: `Photo ${i + 1}` }), h("span", { class: "n" }, i + 1), h("button", { class: "x", "aria-label": `Remove photo ${i + 1}`, onclick: () => this.removeShot(i) }, "✕")),
      ),
    );
    const need = this.needed();
    append(this.panel, [
      this.mode === "photo" && this.shots.length ? h("div", { class: "card" }, h("h3", null, `Your photos (${this.shots.length})`), thumbs, need ? h("p", { class: "note" }, `This frame shows ${photosFor(this.frame, this.ratio)} photos: ${need} more to go.`) : null) : null,
      h("div", { class: "card" }, h("h3", null, "Frame"), tabs, strip, h("p", { class: "note" }, frameMeta(this.frame).best)),
      h("div", { class: "card" }, h("h3", null, "Colours"), swatches, h("h3", null, "Size"), sizes),
      h("div", { class: "card" }, h("h3", null, "Words"), fields),
      this.mode === "photo" && this.shots.length ? this.actions() : null,
      this.mode === "photo" && this.shots.length && c.video.enabled ? this.videoCard() : null,
      this.mode === "clip" && this.clip ? this.clipCard() : null,
    ]);
  }

  /** The name: typed, picked from the booth's list of names, or made up with 🎲. */
  private nameField() {
    const p = this.cfg.person;
    const listId = "qp-names";
    const input = h("input", { type: "text", value: this.name, maxLength: 40, placeholder: "Shown on the frames (optional)", autocomplete: "off", enterkeyhint: "done", list: p.names.length ? listId : undefined });
    input.addEventListener("input", () => {
      this.name = input.value;
      void this.redraw();
    });
    const list = p.names.length ? h("datalist", { id: listId }, ...p.names.map((n) => h("option", { value: n }))) : null;
    const dice = p.suggest.first.length && p.suggest.last.length
      ? h("button", { class: "small", type: "button", "aria-label": "Make up a name", onclick: () => {
          const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;
          input.value = this.name = `${pick(p.suggest.first)} ${pick(p.suggest.last)}`;
          void this.redraw();
        } }, "🎲 Give me one")
      : null;
    return h("label", { class: "field" }, p.nameLabel, h("div", { class: "row", style: { flexWrap: "nowrap" } }, input, dice), list);
  }

  private handle: { network: Network; username: string } = { network: "telegram", username: "" };

  /** Their username and where it's from; shown with their picture in a tag on every frame. */
  private handleField() {
    const nets = this.cfg.person.handle.networks;
    if (!nets.includes(this.handle.network)) this.handle.network = nets[0]!;
    const sel = h("select", { "aria-label": "Network", style: { width: "auto", flex: "0 0 auto" } }, ...nets.map((n) => h("option", { value: n, selected: n === this.handle.network }, NETWORKS[n].label)));
    const input = h("input", { type: "text", value: this.handle.username ? `@${this.handle.username}` : "", maxLength: 60, placeholder: "@username", autocomplete: "off", autocapitalize: "none", spellcheck: false, enterkeyhint: "done" });
    sel.addEventListener("change", () => {
      this.handle.network = sel.value as Network;
      this.renderPanel();
      void this.redraw();
    });
    input.addEventListener("input", () => {
      this.handle.username = cleanHandle(input.value);
      void this.redraw();
    });
    // tidy a pasted link ("https://t.me/name") into "@name" when they leave the field
    input.addEventListener("change", () => (input.value = this.handle.username ? `@${this.handle.username}` : ""));
    return h("label", { class: "field" }, this.cfg.person.handle.label, h("div", { class: "row", style: { flexWrap: "nowrap" } }, sel, input));
  }

  /** Their picture: from their Telegram or X profile (with the server's lookup), an upload, or set by the host page (an NFT). */
  private pictureField() {
    const endpoint = this.getAttribute("avatar-endpoint");
    const net = this.handle.network;
    const canLookUp = endpoint && (net === "telegram" || net === "x");
    const file = h("input", { type: "file", accept: "image/*", style: { display: "none" } });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      file.value = "";
      if (f) await this.setAvatar(f);
      this.renderPanel();
    });
    const lookUp = canLookUp
      ? h("button", { class: "small", type: "button", onclick: async (e: Event) => {
          const b = e.currentTarget as HTMLButtonElement;
          if (!this.handle.username) return this.status(`Type your ${NETWORKS[net].label} username first.`, true);
          b.disabled = true;
          this.status(`Getting your ${NETWORKS[net].label} picture…`);
          try {
            const u = new URL(endpoint, document.baseURI);
            u.searchParams.set("network", net);
            u.searchParams.set("handle", this.handle.username);
            const r = await fetch(u, { credentials: "same-origin" });
            const body = (await r.json().catch(() => ({}))) as { picture?: string; error?: string };
            if (!r.ok || !body.picture?.startsWith("data:image/")) throw new Error(body.error || "Couldn't get that picture.");
            await this.setAvatar(dataUrlBlob(body.picture));
            this.status("Got it. It shows in the tag on your photo.");
          } catch (err) {
            this.status(err instanceof Error ? err.message : "Couldn't get that picture.", true);
          } finally {
            b.disabled = false;
            this.renderPanel();
          }
        } }, `Use my ${NETWORKS[net].label} picture`)
      : null;
    const preview = this.avatar ? h("canvas", { width: 44, height: 44, style: { width: "44px", height: "44px", borderRadius: "50%" } }) : null;
    if (preview && this.avatar) {
      const g = preview.getContext("2d")!;
      const k = Math.max(44 / this.avatar.width, 44 / this.avatar.height);
      g.drawImage(this.avatar, 22 - (this.avatar.width * k) / 2, 22 - (this.avatar.height * k) / 2, this.avatar.width * k, this.avatar.height * k);
    }
    return h(
      "div",
      { class: "field" },
      "Your picture",
      h("span", { class: "hint" }, canLookUp ? "Your public profile picture, or upload one (an NFT, a selfie). Nothing is kept." : "Upload one: a profile picture, an NFT, a selfie."),
      h("div", { class: "row" }, preview, lookUp, h("label", { class: "btn small" }, this.avatar ? "Change" : "Upload", file), this.avatar ? h("button", { class: "small", type: "button", onclick: () => void this.setAvatar(null).then(() => this.renderPanel()) }, "Remove") : null),
    );
  }

  private text(label: string, value: string, max: number, onInput: (v: string) => void, hint = "") {
    const input = h("input", { type: "text", value, maxLength: max, placeholder: hint, autocomplete: "off", enterkeyhint: "done" });
    input.addEventListener("input", () => {
      onInput(input.value);
      void this.redraw();
    });
    return h("label", { class: "field" }, label, input);
  }

  private frameChip(f: FrameMeta) {
    const thumb = h("canvas", { width: 72, height: 128 });
    const chip = h("button", { class: "chip", "aria-pressed": String(this.frame === f.id), title: f.best, onclick: () => this.set({ frame: f.id, ratio: f.ratio }) }, thumb, f.label);
    const photos = this.shown(f.id, f.ratio);
    queue(async () => {
      const p = await createPreviewer({ config: this.cfg, frame: f.id, ratio: f.ratio, palette: this.palette === "photo" ? "brand" : this.palette, words: this.typed, name: this.name, caption: this.caption });
      p.draw(thumb, 144, photos);
    });
    return chip;
  }

  private actions() {
    const canShare = typeof navigator !== "undefined" && "canShare" in navigator;
    const hd = h("input", { type: "checkbox", checked: this.hd });
    hd.addEventListener("change", () => (this.hd = hd.checked));
    return h(
      "div",
      { class: "card" },
      h("h3", null, "Save or share"),
      h(
        "div",
        { class: "row" },
        h("button", { class: "primary big", onclick: () => void this.save(false), disabled: this.needed() > 0 }, "⬇ Save photo"),
        canShare ? h("button", { class: "big", onclick: () => void this.save(true), disabled: this.needed() > 0 }, "Share") : null,
      ),
      h("label", { class: "check" }, hd, "HD (sharper, bigger file)"),
    );
  }

  /* --------------------------------------------------------- the photo */

  private needed() {
    const n = photosFor(this.frame, this.ratio);
    return n > 1 && this.shots.length ? Math.max(0, n - this.shots.length) : 0;
  }

  /** What a frame shows: the shots (newest first), else the samples repeated to fill it. */
  private shown(frame = this.frame, ratio = this.ratio): ImageBitmap[] {
    if (this.mode === "clip" && this.clip) return [this.clip.canvas as unknown as ImageBitmap];
    if (this.shots.length) return this.shots.map((s) => s.image);
    const n = Math.max(this.samples.length, photosFor(frame, ratio));
    return this.samples.length ? Array.from({ length: n }, (_, i) => this.samples[i % this.samples.length]!) : [];
  }

  private set(p: Partial<{ frame: FrameId; ratio: Ratio; palette: PaletteChoice }>) {
    if (p.frame) this.frame = p.frame;
    if (p.ratio) this.ratio = p.ratio;
    if (p.palette !== undefined) this.palette = p.palette;
    // a frame's own colour set doesn't carry over to another frame
    if (p.frame && typeof this.palette === "number") this.palette = "brand";
    this.renderPanel();
    void this.redraw();
  }

  private async redraw() {
    const seq = ++this.renderSeq;
    const p = await createPreviewer({ config: this.cfg, frame: this.frame, ratio: this.ratio, palette: this.palette, words: this.typed, name: this.name, caption: this.caption, avatar: this.avatar ?? undefined, handle: this.handle });
    if (seq !== this.renderSeq) return;
    this.previewer = p;
    if (!this.live()) p.draw(this.view, VIEW_W, this.shown());
  }

  private options() {
    return { config: this.cfg, frame: this.frame, ratio: this.ratio, palette: this.palette, words: this.typed, name: this.name, caption: this.caption, avatar: this.avatar ?? undefined, handle: this.handle, photos: this.shots.map((s) => s.image) };
  }

  private fileName(kind: string, ext: string) {
    return `${slug(this.cfg.brand.name || this.cfg.title)}-${kind}-${this.frame}-${Date.now().toString(36)}.${ext}`;
  }

  private async save(share: boolean) {
    this.status("Making your photo…");
    try {
      const blob = await renderPhoto({ ...this.options(), hd: this.hd });
      const name = this.fileName("photo", "jpg");
      emit(this, "questpass:photo", { blob, frame: this.frame, ratio: this.ratio, name });
      if (share && (await shareFile(blob, name, shareTextOf(this.cfg)))) {
        emit(this, "questpass:share", { kind: "photo", method: "share" });
      } else {
        download(blob, name);
        emit(this, "questpass:share", { kind: "photo", method: "download" });
      }
      this.status("Done.");
    } catch {
      this.status("Couldn't make the photo. Try again.", true);
    }
  }

  private async addShot(image: ImageBitmap) {
    const c = document.createElement("canvas");
    const k = Math.min(1, 160 / Math.max(image.width, image.height));
    c.width = Math.round(image.width * k);
    c.height = Math.round(image.height * k);
    c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
    this.shots.unshift({ image, thumb: c.toDataURL("image/jpeg", 0.8) });
    while (this.shots.length > this.cfg.maxPhotos) this.shots.pop()?.image.close();
  }

  private removeShot(i: number) {
    const [s] = this.shots.splice(i, 1);
    s?.image.close();
    this.renderControls();
    this.renderPanel();
    void this.redraw();
  }

  private async addFiles(files: FileList | null) {
    if (!files?.length) return;
    this.stopCamera();
    let failed = 0;
    for (const f of Array.from(files).slice(0, this.cfg.maxPhotos)) {
      try {
        await this.addShot(await toBitmap(f));
      } catch {
        failed++;
      }
    }
    if (failed) this.status(failed === 1 ? "One photo couldn't be opened." : `${failed} photos couldn't be opened.`, true);
    this.renderControls();
    this.renderPanel();
    void this.redraw();
  }

  /* --------------------------------------------------------- the camera */

  private async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.status("This browser can't open the camera. Choose photos instead.", true);
      return;
    }
    this.stopCamera();
    const turn = this.cameraTurn;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 2560 }, height: { ideal: 2560 } }, audio: false });
      // turned off (or left) while it was opening: stop it at once
      if (turn !== this.cameraTurn || !this.isConnected || document.hidden) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = s;
      this.feed.srcObject = s;
      await this.feed.play().catch(() => undefined);
      emit(this, "questpass:camera", { on: true });
      this.idleTimer = window.setTimeout(this.stopCamera, this.cfg.camera.idleSeconds * 1000);
      this.renderControls();
      this.loop();
      this.status("");
    } catch {
      this.status("The camera didn't open. Allow it in the browser, or choose photos instead.", true);
    }
  }

  /** Really off: every track stopped (the camera light goes out) and the video let go. */
  stopCamera = () => {
    // a recording in progress keeps what it has (it finishes in onstop)
    if (this.recorder && this.recorder.state === "recording") this.recorder.stop();
    clearInterval(this.recordTimer);
    this.cameraTurn++;
    clearTimeout(this.idleTimer);
    cancelAnimationFrame(this.raf);
    const was = this.stream !== null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.feed.srcObject = null;
    if (was) {
      emit(this, "questpass:camera", { on: false });
      this.renderControls();
      void this.redraw();
    }
  };

  private async flip() {
    this.facing = this.facing === "user" ? "environment" : "user";
    await this.startCamera();
  }

  /** The camera's picture now (mirrored for the front camera, like a mirror). */
  private frameOfVideo(): HTMLCanvasElement | null {
    const v = this.feed;
    if (!v.videoWidth) return null;
    const c = this.grab;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext("2d");
    if (!g) return null;
    g.save();
    if (this.facing === "user") {
      g.translate(c.width, 0);
      g.scale(-1, 1);
    }
    g.drawImage(v, 0, 0);
    g.restore();
    return c;
  }

  private loop() {
    let last = 0;
    const tick = (now: number) => {
      if (!this.live()) return;
      this.raf = requestAnimationFrame(tick);
      // about 15 a second: smooth enough, and easy on the phone
      if (now - last < 66) return;
      last = now;
      const shot = this.frameOfVideo();
      if (shot && this.previewer) {
        try {
          this.previewer.draw(this.view, VIEW_W, this.mode === "clip" ? [shot] : [shot, ...this.shots.map((s) => s.image)]);
        } catch {
          // skip a frame that fails to draw
        }
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private async shoot() {
    if (this.busy || !this.live()) return;
    this.busy = true;
    this.renderControls();
    const want = photosFor(this.frame, this.ratio);
    const n = want > 1 ? Math.max(1, want - (this.shots.length % want)) : 1;
    try {
      for (let i = 0; i < n; i++) {
        const from = i === 0 ? (this.cfg.camera.timer ? 3 : 0) : 2;
        for (let k = from; k > 0; k--) {
          this.countEl.textContent = String(k);
          await wait(800);
          if (!this.live()) break;
        }
        this.countEl.textContent = "";
        const c = this.live() ? this.frameOfVideo() : null;
        if (!c) break;
        this.flashEl.classList.add("on");
        setTimeout(() => this.flashEl.classList.remove("on"), 120);
        await this.addShot(await createImageBitmap(c));
        if (i < n - 1) await wait(400);
      }
    } finally {
      this.countEl.textContent = "";
      this.busy = false;
      // got the shot: the camera goes off straight away
      this.stopCamera();
      this.renderControls();
      this.renderPanel();
      void this.redraw();
    }
  }

  /* ---------------------------------------------------- video clips */

  private renderClipControls() {
    if (this.recorder) {
      append(this.controls, [
        h("button", { class: "primary big", onclick: this.stopCamera, "aria-label": "Stop recording" }, `■ Stop (${this.recordLeft}s)`),
        h("p", { class: "note wide", style: { textAlign: "center" } }, "Recording… it stops by itself at 15 seconds."),
      ]);
      return;
    }
    const input = h("input", { type: "file", accept: "video/*", style: { display: "none" } });
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      input.value = "";
      if (f) void this.openClip(f);
    });
    append(this.controls, [
      this.clip ? h("button", { class: "primary big", onclick: () => (this.clipPlaying ? this.pauseClip() : this.playClip()) }, this.clipPlaying ? "❚❚ Pause" : "▶ Play") : null,
      h("button", { class: this.clip ? "big" : "primary big", onclick: () => void this.startRecording() }, this.clip ? "🎥 Record again" : "🎥 Record a clip"),
      h("label", { class: "btn" }, this.clip ? "Choose another" : "📁 Choose a video", input),
      !this.clip ? h("p", { class: "note wide", style: { textAlign: "center" } }, `Up to ${CLIP_MAX_SEC} seconds plays inside the frame. Your video stays on your phone.`) : null,
    ]);
  }

  private async openClip(blob: Blob) {
    this.pauseClip();
    this.status("Opening your video…");
    try {
      const next = await ClipSource.open(blob);
      this.clip?.close();
      this.clip = next;
      this.clipStart = 0;
      this.clipLen = Math.min(CLIP_MAX_SEC, Math.max(1, Math.floor(next.duration * 10) / 10));
      this.status("");
    } catch (e) {
      this.status(e instanceof Error ? e.message : "That video couldn't be opened.", true);
    }
    this.renderControls();
    this.renderPanel();
    void this.redraw();
  }

  /** Record a clip with the camera and microphone (at most 15 s), then frame it. */
  private async startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      this.status("This browser can't record video. Choose a video instead.", true);
      return;
    }
    this.pauseClip();
    this.stopCamera();
    const turn = this.cameraTurn;
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: true });
    } catch {
      this.status("The camera didn't open. Allow camera and microphone in the browser, or choose a video.", true);
      return;
    }
    if (turn !== this.cameraTurn || !this.isConnected || document.hidden) {
      s.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = s;
    this.feed.srcObject = s;
    await this.feed.play().catch(() => undefined);
    emit(this, "questpass:camera", { on: true });
    const type = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      this.recorder = null;
      clearInterval(this.recordTimer);
      // the camera and microphone go off as soon as the recording ends
      this.stopCamera();
      if (chunks.length) void this.openClip(new Blob(chunks, { type: (rec.mimeType || type || "video/webm").split(";")[0] }));
      else this.renderControls();
    };
    this.recorder = rec;
    this.recordLeft = 15;
    rec.start(250);
    this.recordTimer = window.setInterval(() => {
      this.recordLeft--;
      if (this.recordLeft <= 0) this.stopCamera();
      else this.renderControls();
    }, 1000);
    this.renderControls();
    this.loop();
  }

  /** Play the trimmed stretch inside the frame, round and round, until paused. */
  private playClip() {
    const c = this.clip;
    if (!c || !this.previewer) return;
    const v = c.video;
    // the preview plays the clip's own sound unless it's music only
    v.muted = this.clipSound === "music";
    if (v.currentTime < this.clipStart || v.currentTime > this.clipStart + this.clipLen) v.currentTime = this.clipStart;
    void v.play().catch(() => undefined);
    this.clipPlaying = true;
    const tick = () => {
      if (!this.clipPlaying || !this.clip) return;
      if (v.currentTime >= this.clipStart + this.clipLen || v.ended) v.currentTime = this.clipStart;
      this.clip.draw();
      this.previewer?.draw(this.view, VIEW_W, [this.clip.canvas]);
      this.clipRaf = requestAnimationFrame(tick);
    };
    this.clipRaf = requestAnimationFrame(tick);
    this.renderControls();
  }

  private pauseClip() {
    if (!this.clipPlaying) return;
    this.clipPlaying = false;
    cancelAnimationFrame(this.clipRaf);
    this.clip?.video.pause();
    if (this.isConnected) this.renderControls();
  }

  private clipCard() {
    const c = this.clip!;
    const maxStart = Math.max(0, Math.floor((c.duration - 0.5) * 10) / 10);
    const fmt = (s: number) => `${s.toFixed(1)}s`;
    const startOut = h("output", null, fmt(this.clipStart));
    const lenOut = h("output", null, fmt(this.clipLen));
    const start = h("input", { type: "range", min: 0, max: maxStart, step: 0.1, value: this.clipStart, "aria-label": "Start" });
    const len = h("input", { type: "range", min: 1, max: Math.max(1, Math.min(CLIP_MAX_SEC, c.duration - this.clipStart)), step: 0.1, value: this.clipLen, "aria-label": "Length" });
    start.addEventListener("input", () => {
      this.clipStart = Number(start.value);
      this.clipLen = Math.min(this.clipLen, Math.max(1, c.duration - this.clipStart));
      len.max = String(Math.max(1, Math.min(CLIP_MAX_SEC, c.duration - this.clipStart)));
      len.value = String(this.clipLen);
      startOut.textContent = fmt(this.clipStart);
      lenOut.textContent = fmt(this.clipLen);
      void c.frameAt(this.clipStart).then(() => !this.clipPlaying && this.previewer?.draw(this.view, VIEW_W, [c.canvas]));
    });
    len.addEventListener("input", () => {
      this.clipLen = Number(len.value);
      lenOut.textContent = fmt(this.clipLen);
    });
    const sound = h("select", { "aria-label": "Sound" }, ...([["both", "Video sound + music"], ["clip", "Video sound only"], ["music", "Music only"]] as const).map(([v, l]) => h("option", { value: v, selected: v === this.clipSound }, l)));
    sound.addEventListener("change", () => {
      this.clipSound = sound.value as ClipSound;
      c.video.muted = this.clipSound === "music";
      track.disabled = this.clipSound === "clip";
    });
    const meta = frameMeta(this.frame);
    const track = h("select", { "aria-label": "Music", disabled: this.clipSound === "clip" });
    for (const t of listTracks()) track.appendChild(h("option", { value: t.id, selected: t.id === (this.clipTrack || meta.tracks[0]) }, t.name));
    track.addEventListener("change", () => (this.clipTrack = track.value));
    const quality = h("select", { "aria-label": "Quality" }, h("option", { value: "high" }, "Sharp (bigger file)"), h("option", { value: "small" }, "Smaller file"));
    const bar = h("progress", { max: 1, value: 0, hidden: true });
    const out = h("div", { style: { display: "grid", gap: "10px" } });
    let ctrl: AbortController | null = null;
    const cancel = h("button", { class: "small", hidden: true, onclick: () => ctrl?.abort() }, "Cancel");
    const go = h("button", { class: "primary big wide" }, "🎬 Make my video");
    go.addEventListener("click", async () => {
      this.pauseClip();
      ctrl = new AbortController();
      go.disabled = true;
      cancel.hidden = false;
      bar.hidden = false;
      clear(out);
      this.status("Making your video… keep this page open.");
      try {
        const { photos: _p, ...opts } = this.options();
        void _p;
        const { blob, type } = await makeClipVideo({
          ...opts,
          clip: c,
          start: this.clipStart,
          length: this.clipLen,
          sound: this.clipSound,
          track: this.clipTrack || meta.tracks[0],
          quality: quality.value === "small" ? "small" : "high",
          signal: ctrl.signal,
          onProgress: (s, total) => (bar.value = total ? s / total : 0),
        });
        if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
        this.videoUrl = URL.createObjectURL(blob);
        const name = this.fileName("video", type.includes("mp4") ? "mp4" : "webm");
        emit(this, "questpass:video", { blob, type, frame: this.frame, name, source: "clip" });
        const canShare = typeof navigator !== "undefined" && "canShare" in navigator;
        append(out, [
          h("video", { class: "result", src: this.videoUrl, controls: true, playsInline: true }),
          h(
            "div",
            { class: "row" },
            h("button", { class: "primary", onclick: () => (download(blob, name), emit(this, "questpass:share", { kind: "video", method: "download" })) }, "⬇ Save video"),
            canShare ? h("button", { onclick: async () => { if (await shareFile(blob, name, shareTextOf(this.cfg))) emit(this, "questpass:share", { kind: "video", method: "share" }); else download(blob, name); } }, "Share") : null,
          ),
        ]);
        this.status("Your video is ready.");
      } catch (e) {
        const stopped = e instanceof DOMException && e.name === "AbortError";
        this.status(stopped ? "Stopped." : e instanceof Error && e.message ? e.message : "Couldn't make the video.", !stopped);
      } finally {
        go.disabled = false;
        cancel.hidden = true;
        bar.hidden = true;
      }
    });
    return h(
      "div",
      { class: "card" },
      h("h3", null, "Your video"),
      h("p", { class: "note" }, `${fmt(c.duration)} long. Up to ${CLIP_MAX_SEC}s plays inside the frame.`),
      h("label", { class: "field" }, h("span", null, "Start at ", startOut), start),
      h("label", { class: "field" }, h("span", null, "Length ", lenOut), len),
      h("div", { class: "grid2" }, h("label", { class: "field" }, "Sound", sound), h("label", { class: "field" }, "Music", track)),
      h("label", { class: "field" }, "Quality", quality),
      go,
      bar,
      cancel,
      out,
      h("p", { class: "note" }, "Made on your phone; nothing is uploaded."),
    );
  }

  /* --------------------------------------------------------- the video */

  /** The recap's photos (the shots) and clips, in the order they play; kept in step with the shots. */
  private syncReel() {
    this.reel = this.reel.filter((e) => e.kind === "clip" || this.shots.includes(e.shot));
    for (const shot of this.shots) if (!this.reel.some((e) => e.kind === "photo" && e.shot === shot)) this.reel.push({ kind: "photo", shot });
  }

  private async addReelClips(files: FileList | null) {
    for (const f of Array.from(files ?? []).slice(0, 6)) {
      try {
        const clip = await ClipSource.open(f);
        const t = document.createElement("canvas");
        const k = Math.min(1, 160 / Math.max(clip.canvas.width, clip.canvas.height));
        t.width = Math.round(clip.canvas.width * k);
        t.height = Math.round(clip.canvas.height * k);
        t.getContext("2d")!.drawImage(clip.canvas, 0, 0, t.width, t.height);
        this.reel.push({ kind: "clip", clip, start: 0, length: Math.min(REEL_CLIP_MAX_SEC, Math.max(1, Math.floor(clip.duration))), thumb: t.toDataURL("image/jpeg", 0.8) });
      } catch (e) {
        this.status(e instanceof Error ? e.message : "A video couldn't be opened.", true);
      }
    }
    this.renderPanel();
    const det = [...this.panel.querySelectorAll("details")].find((d) => d.textContent?.includes("Also make a video"));
    if (det) det.open = true;
  }

  private videoCard() {
    this.syncReel();
    const list = h("div", { class: "order" });
    const draw = () => {
      clear(list);
      let photo = 0;
      let clipN = 0;
      this.reel.forEach((e, i) => {
        const label = e.kind === "photo" ? `Photo ${++photo}` : `🎥 Video ${++clipN}`;
        const length =
          e.kind === "clip"
            ? (() => {
                const sel = h("select", { "aria-label": `${label} length`, style: { width: "auto", minHeight: "36px", padding: "4px 8px" } });
                for (const sec of [2, 3, 4, 6, 8, 10].filter((x) => x <= Math.max(2, Math.floor(e.clip.duration)))) sel.appendChild(h("option", { value: sec, selected: sec === e.length }, `${sec}s`));
                sel.addEventListener("change", () => (e.length = Number(sel.value)));
                return sel;
              })()
            : null;
        list.appendChild(
          h(
            "div",
            { class: "item" },
            h("img", { src: e.kind === "photo" ? e.shot.thumb : e.thumb, alt: label }),
            h("span", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, label, length),
            h(
              "div",
              { class: "moves" },
              h("button", { "aria-label": `Move ${label} earlier`, disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
              h("button", { "aria-label": `Move ${label} later`, disabled: i === this.reel.length - 1, onclick: () => move(i, 1) }, "↓"),
              e.kind === "clip" ? h("button", { "aria-label": `Remove ${label}`, onclick: () => remove(i) }, "✕") : null,
            ),
          ),
        );
      });
    };
    const move = (i: number, d: number) => {
      const j = i + d;
      [this.reel[i], this.reel[j]] = [this.reel[j]!, this.reel[i]!];
      // the photos keep the same order in the frame as in the video
      this.shots = this.reel.filter((e): e is { kind: "photo"; shot: Shot } => e.kind === "photo").map((e) => e.shot);
      draw();
      void this.redraw();
    };
    const remove = (i: number) => {
      const [e] = this.reel.splice(i, 1);
      if (e?.kind === "clip") e.clip.close();
      draw();
    };
    draw();
    const addClips = h("input", { type: "file", accept: "video/*", multiple: true, style: { display: "none" } });
    addClips.addEventListener("change", () => {
      void this.addReelClips(addClips.files).then(() => (addClips.value = ""));
    });
    const clipSound = h("input", { type: "checkbox", checked: this.reelClipSound });
    clipSound.addEventListener("change", () => (this.reelClipSound = clipSound.checked));
    const meta = frameMeta(this.frame);
    const track = h("select", { "aria-label": "Music" });
    for (const t of listTracks()) track.appendChild(h("option", { value: t.id, selected: t.id === meta.tracks[0] }, t.name));
    const title = h("input", { type: "text", maxLength: 50, placeholder: "A line after the title (optional)" });
    const quality = h("select", { "aria-label": "Quality" }, h("option", { value: "high" }, "Sharp (bigger file)"), h("option", { value: "small" }, "Smaller file"));
    const bar = h("progress", { max: 1, value: 0, hidden: true });
    const out = h("div", { style: { display: "grid", gap: "10px" } });
    let ctrl: AbortController | null = null;
    const go = h("button", { class: "primary big wide" }, "🎬 Make my video");
    const cancel = h("button", { class: "small", hidden: true, onclick: () => ctrl?.abort() }, "Cancel");
    go.addEventListener("click", async () => {
      ctrl = new AbortController();
      go.disabled = true;
      cancel.hidden = false;
      bar.hidden = false;
      clear(out);
      this.status("Making your video… keep this page open.");
      try {
        const { blob, type } = await makeVideo({
          ...this.options(),
          // in the order shown (first = first in the video): photos and clips
          photos: [],
          order: this.reel.map((e) => (e.kind === "photo" ? e.shot.image : { clip: e.clip, start: e.start, length: e.length })),
          clipSound: this.reelClipSound,
          title: title.value,
          track: track.value,
          quality: quality.value === "small" ? "small" : "high",
          signal: ctrl.signal,
          onProgress: (s, total) => (bar.value = total ? s / total : 0),
        });
        if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
        this.videoUrl = URL.createObjectURL(blob);
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const name = this.fileName("video", ext);
        emit(this, "questpass:video", { blob, type, frame: this.frame, name });
        const canShare = typeof navigator !== "undefined" && "canShare" in navigator;
        append(out, [
          h("video", { class: "result", src: this.videoUrl, controls: true, playsInline: true }),
          h(
            "div",
            { class: "row" },
            h("button", { class: "primary", onclick: () => (download(blob, name), emit(this, "questpass:share", { kind: "video", method: "download" })) }, "⬇ Save video"),
            canShare
              ? h("button", { onclick: async () => { if (await shareFile(blob, name, shareTextOf(this.cfg))) emit(this, "questpass:share", { kind: "video", method: "share" }); else download(blob, name); } }, "Share")
              : null,
          ),
        ]);
        this.status("Your video is ready.");
      } catch (e) {
        this.status(e instanceof DOMException && e.name === "AbortError" ? "Stopped." : e instanceof Error && e.message ? e.message : "Couldn't make the video.", !(e instanceof DOMException && e.name === "AbortError"));
      } finally {
        go.disabled = false;
        cancel.hidden = true;
        bar.hidden = true;
      }
    });
    return h(
      "details",
      { class: "card" },
      h("summary", null, "🎬 Also make a video"),
      h("p", { class: "note" }, `Your photos and video clips in the ${meta.label} frame, cut to music. Made on your phone; nothing is uploaded.`),
      list,
      h("div", { class: "row" }, h("label", { class: "btn small" }, "＋ Add video clips", addClips), this.reel.some((e) => e.kind === "clip") ? h("label", { class: "check" }, clipSound, "Clips' own sound under the music") : null),
      h("label", { class: "field" }, "Line after the title", title),
      h("div", { class: "grid2" }, h("label", { class: "field" }, "Music", track), h("label", { class: "field" }, "Quality", quality)),
      go,
      bar,
      cancel,
      out,
      h("p", { class: "note" }, `The video ends with “Made with QuestPass”.`),
    );
  }
}
