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

const SIZES: Array<[Ratio, string]> = [
  ["9:16", "Story"],
  ["4:5", "Post"],
  ["1:1", "Square"],
  ["16:9", "Wide"],
];
const VIEW_W = 540;
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
    return ["config", "config-src"];
  }

  private root: ShadowRoot;
  private cfg!: BoothConfig;
  private configProp: unknown = undefined;
  private shots: Shot[] = [];
  private samples: ImageBitmap[] = [];
  private frame: FrameId = "polaroid";
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
    document.removeEventListener("visibilitychange", this.onHidden);
    window.removeEventListener("pagehide", this.stopCamera);
  }

  attributeChangedCallback() {
    if (this.isConnected && this.configProp === undefined) void this.load();
  }

  private onHidden = () => {
    if (document.hidden) this.stopCamera();
  };

  private async load() {
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
        h("div", { class: "stage" }, this.view, this.feed, this.countEl, this.flashEl),
        this.controls,
        this.statusEl,
        this.panel,
        c.credit ? h("p", { class: "credit" }, "Made with ", h("a", { href: "https://github.com/simarpreetsingh-019/questpass-booth", target: "_blank", rel: "noopener noreferrer" }, "QuestPass Booth")) : null,
      ),
    ]);
    this.renderControls();
    this.renderPanel();
  }

  private live() {
    return this.stream !== null;
  }

  private renderControls() {
    clear(this.controls);
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
    const frames = listFrames().filter((f) => offeredFrames(c).includes(f.id));
    // frames
    const strip = h("div", { class: "row scroll", role: "group", "aria-label": "Frames" });
    for (const f of frames) strip.appendChild(this.frameChip(f));
    // colours
    const swatches = h("div", { class: "row scroll", role: "group", "aria-label": "Colours" });
    const sw = (choice: PaletteChoice, color: string, label: string) =>
      h("button", { class: "swatch", style: { background: color }, title: label, "aria-label": label, "aria-pressed": String(this.palette === choice), onclick: () => this.set({ palette: choice }) });
    swatches.appendChild(sw("brand", c.brand.colors.accent, `${c.brand.name || "Brand"} colours`));
    if (this.shots.length) swatches.appendChild(h("button", { class: "swatch", style: { background: "conic-gradient(#f66,#fc6,#6f9,#6cf,#c6f,#f66)" }, title: "From my photo", "aria-label": "Colours from my photo", "aria-pressed": String(this.palette === "photo"), onclick: () => this.set({ palette: "photo" }) }));
    for (const p of framePalettes(this.frame)) swatches.appendChild(sw(p.index, p.accent, p.name));
    // size
    const sizes = h("div", { class: "row", role: "group", "aria-label": "Size" });
    for (const [r, label] of SIZES) {
      sizes.appendChild(h("button", { class: "small", "aria-pressed": String(this.ratio === r), style: this.ratio === r ? { borderColor: "var(--qp-accent)" } : {}, onclick: () => this.set({ ratio: r }) }, label));
    }
    // words
    const fields = h("div", { style: { display: "grid", gap: "10px" } });
    fields.appendChild(this.text("Caption", this.caption, 60, (v) => (this.caption = v), "A line for the photo (optional)"));
    fields.appendChild(this.text("Your name", this.name, 30, (v) => (this.name = v), "Shown on some frames (optional)"));
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
      this.shots.length ? h("div", { class: "card" }, h("h3", null, `Your photos (${this.shots.length})`), thumbs, need ? h("p", { class: "note" }, `This frame shows ${photosFor(this.frame, this.ratio)} photos: ${need} more to go.`) : null) : null,
      h("div", { class: "card" }, h("h3", null, "Frame"), strip, h("p", { class: "note" }, frameMeta(this.frame).best)),
      h("div", { class: "card" }, h("h3", null, "Colours"), swatches, h("h3", null, "Size"), sizes),
      h("div", { class: "card" }, h("h3", null, "Words"), fields),
      this.shots.length ? this.actions() : null,
      this.shots.length && c.video.enabled ? this.videoCard() : null,
    ]);
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
    const p = await createPreviewer({ config: this.cfg, frame: this.frame, ratio: this.ratio, palette: this.palette, words: this.typed, name: this.name, caption: this.caption });
    if (seq !== this.renderSeq) return;
    this.previewer = p;
    if (!this.live()) p.draw(this.view, VIEW_W, this.shown());
  }

  private options() {
    return { config: this.cfg, frame: this.frame, ratio: this.ratio, palette: this.palette, words: this.typed, name: this.name, caption: this.caption, photos: this.shots.map((s) => s.image) };
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
          this.previewer.draw(this.view, VIEW_W, [shot, ...this.shots.map((s) => s.image)]);
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

  /* --------------------------------------------------------- the video */

  private videoCard() {
    const list = h("div", { class: "order" });
    const draw = () => {
      clear(list);
      this.shots.forEach((s, i) => {
        list.appendChild(
          h(
            "div",
            { class: "item" },
            h("img", { src: s.thumb, alt: `Photo ${i + 1}` }),
            h("span", null, `Photo ${i + 1}`),
            h(
              "div",
              { class: "moves" },
              h("button", { "aria-label": `Move photo ${i + 1} earlier`, disabled: i === 0, onclick: () => move(i, -1) }, "↑"),
              h("button", { "aria-label": `Move photo ${i + 1} later`, disabled: i === this.shots.length - 1, onclick: () => move(i, 1) }, "↓"),
            ),
          ),
        );
      });
    };
    const move = (i: number, d: number) => {
      const j = i + d;
      [this.shots[i], this.shots[j]] = [this.shots[j]!, this.shots[i]!];
      draw();
      void this.redraw();
    };
    draw();
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
          // in the order shown (first = first in the video)
          photos: this.shots.map((s) => s.image),
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
      h("p", { class: "note" }, `Your photos in the ${meta.label} frame, cut to music. Made on your phone; nothing is uploaded.`),
      list,
      h("label", { class: "field" }, "Line after the title", title),
      h("div", { class: "grid2" }, h("label", { class: "field" }, "Music", track), h("label", { class: "field" }, "Quality", quality)),
      go,
      bar,
      cancel,
      out,
      this.cfg.credit ? h("p", { class: "note" }, `The video ends with "${CREDIT_LINE}".`) : null,
    );
  }
}
