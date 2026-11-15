/**
 * <questpass-booth-editor>: set up a booth (title, brand, logo, colours,
 * frames, text spaces, video and sharing) with a live preview, and get the
 * config as JSON. It never saves anything itself: the host page listens for
 * `change` (detail.config) and stores it wherever it keeps its own data.
 *
 *   <questpass-booth-editor brand-endpoint="/api/brand"></questpass-booth-editor>
 *
 * brand-endpoint (optional): your server's brand lookup (questpass-booth/server),
 * for "Fill in from website". Without it, the logo is uploaded by hand.
 * A logo picked here is redrawn as a PNG on the device (at most 512 px),
 * which also drops any hidden data in the file.
 */
import { CONFIG_VERSION, LIMITS, defaultConfig, listWordSlots, normalizeConfig, type BoothConfig, type WordMode } from "../core/config";
import { listFrames } from "../core/frames-meta";
import { createPreviewer, type Ratio } from "../core/render";
import { colorsFromImage, CREDIT_LINE } from "../core/brand";
import { samplePhotos } from "../core/samples";
import { append, applyTheme, clear, download, emit, h, readConfig, slug } from "./dom";
import { adoptStyles } from "./styles";

const MODES: Array<[WordMode, string]> = [
  ["fixed", "Fixed"],
  ["edit", "People write"],
  ["off", "Off"],
];

/** A picked logo as a PNG data URL, at most 512 px on its long side. */
async function logoFromFile(file: File): Promise<string> {
  if (file.size > 8_000_000) throw new Error("That file is too big (8 MB at most).");
  const img = await createImageBitmap(file);
  const k = Math.min(1, 512 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return c.toDataURL("image/png");
}

async function imageOf(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
}

export class EditorElement extends HTMLElement {
  static get observedAttributes() {
    return ["config", "config-src", "brand-endpoint"];
  }

  private root: ShadowRoot;
  private cfg: BoothConfig = defaultConfig();
  private configProp: unknown = undefined;
  private samples: ImageBitmap[] = [];
  private previewFrame = "polaroid";
  private previewRatio: Ratio | "" = "";
  private view = h("canvas", { role: "img", "aria-label": "Preview of the booth's frame" });
  private json = h("textarea", { readOnly: true, "aria-label": "The booth's settings as JSON", spellcheck: false });
  private statusEl = h("p", { class: "status", role: "status", "aria-live": "polite" });
  private changeTimer = 0;
  private site = "";
  private seq = 0;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    adoptStyles(this.root);
  }

  get config(): BoothConfig {
    return structuredClone(this.cfg);
  }
  set config(v: unknown) {
    this.configProp = v;
    if (this.isConnected) void this.load();
  }

  connectedCallback() {
    void this.load();
  }

  attributeChangedCallback(name: string, old: string | null, now: string | null) {
    if (name === "brand-endpoint") {
      if (this.loaded) this.build();
      return;
    }
    // the first values are read by connectedCallback; only later changes reload
    if (this.loaded && old !== now && this.configProp === undefined) void this.load();
  }

  private loaded = false;

  private async load() {
    this.loaded = true;
    this.cfg = await readConfig(this, this.configProp);
    this.previewFrame = this.cfg.frames.default;
    if (!this.samples.length) this.samples = await samplePhotos().catch(() => []);
    this.build();
  }

  /** Change the config, redraw the preview, and tell the host (debounced). */
  private update(change: (c: BoothConfig) => void, rebuild = false) {
    const next = structuredClone(this.cfg);
    change(next);
    this.cfg = normalizeConfig(next);
    applyTheme(this, this.cfg);
    this.json.value = JSON.stringify(this.cfg, null, 2);
    if (rebuild) this.build();
    else void this.preview();
    clearTimeout(this.changeTimer);
    this.changeTimer = window.setTimeout(() => emit(this, "change", { config: this.config }), 250);
  }

  private status(msg: string, err = false) {
    this.statusEl.textContent = msg;
    this.statusEl.className = err ? "status err" : "status";
  }

  private async preview() {
    const seq = ++this.seq;
    const frame = this.cfg.frames.allow === "all" || this.cfg.frames.allow.includes(this.previewFrame as never) ? this.previewFrame : this.cfg.frames.default;
    const p = await createPreviewer({ config: this.cfg, frame: frame as never, ratio: this.previewRatio || undefined, palette: "brand" });
    if (seq !== this.seq) return;
    const n = Math.max(this.samples.length, 8);
    p.draw(this.view, 420, this.samples.length ? Array.from({ length: n }, (_, i) => this.samples[i % this.samples.length]!) : []);
  }

  /* -------------------------------------------------------------- form */

  private input(label: string, value: string, max: number, set: (c: BoothConfig, v: string) => void, opts: { type?: string; hint?: string; placeholder?: string } = {}) {
    const el = h("input", { type: opts.type ?? "text", value, maxLength: max, placeholder: opts.placeholder ?? "", autocomplete: "off" });
    el.addEventListener("input", () => this.update((c) => set(c, el.value)));
    // URLs are checked on leaving the field: an unsafe or unfinished one is cleared
    if (opts.type === "url") el.addEventListener("change", () => (el.value = this.urlValue(label)));
    return h("label", { class: "field" }, label, opts.hint ? h("span", { class: "hint" }, opts.hint) : null, el);
  }

  private urlValue(label: string) {
    return label.startsWith("Website") ? this.cfg.brand.website : this.cfg.share.link;
  }

  private check(label: string, value: boolean, set: (c: BoothConfig, v: boolean) => void, rebuild = false) {
    const el = h("input", { type: "checkbox", checked: value });
    el.addEventListener("change", () => this.update((c) => set(c, el.checked), rebuild));
    return h("label", { class: "check" }, el, label);
  }

  private color(label: string, key: keyof BoothConfig["brand"]["colors"]) {
    const el = h("input", { type: "color", value: this.cfg.brand.colors[key].toLowerCase(), "aria-label": label });
    el.addEventListener("input", () => this.update((c) => (c.brand.colors[key] = el.value.toUpperCase())));
    return h("label", { class: "field" }, label, el);
  }

  private build() {
    clear(this.root);
    adoptStyles(this.root);
    applyTheme(this, this.cfg);
    const c = this.cfg;
    this.json.value = JSON.stringify(c, null, 2);

    append(this.root, [
      h(
        "div",
        { class: "wrap editor", part: "editor" },
        h("div", { class: "side", style: { display: "grid", gap: "10px" } }, h("div", { class: "stage" }, this.view), this.previewControls(), this.statusEl),
        h(
          "div",
          { style: { display: "grid", gap: "14px" } },
          this.basics(),
          this.brand(),
          this.frames(),
          this.words(),
          this.videoAndSharing(),
          this.output(),
        ),
      ),
    ]);
    void this.preview();
  }

  private basics() {
    const c = this.cfg;
    return h(
      "div",
      { class: "card" },
      h("h3", null, "The booth"),
      this.input("Title", c.title, LIMITS.title, (c, v) => (c.title = v), { hint: "On the frames and the video's first card" }),
      h("div", { class: "grid2" }, this.input("Place", c.place, LIMITS.place, (c, v) => (c.place = v), { placeholder: "City or venue" }), this.input("Date line", c.dates, LIMITS.dates, (c, v) => (c.dates = v), { placeholder: "Sat 17 May 2026" })),
    );
  }

  private brand() {
    const c = this.cfg;
    const endpoint = this.getAttribute("brand-endpoint");
    const site = h("input", { type: "text", value: this.site, placeholder: "pizzadao.org", maxLength: 200, autocomplete: "off", inputmode: "url" });
    site.addEventListener("input", () => (this.site = site.value));
    const fetchBtn = h("button", { class: "primary" }, "Fill in from website");
    fetchBtn.addEventListener("click", async () => {
      this.site = site.value;
      if (!endpoint || !site.value.trim()) return;
      fetchBtn.disabled = true;
      this.status("Looking up the brand…");
      try {
        const u = new URL(endpoint, document.baseURI);
        u.searchParams.set("url", site.value.trim());
        const r = await fetch(u, { credentials: "same-origin" });
        const body = (await r.json().catch(() => ({}))) as { name?: string; website?: string; logo?: string; themeColor?: string; error?: string };
        if (!r.ok) throw new Error(body.error || "Couldn't read that website.");
        let colors = this.cfg.brand.colors;
        if (body.logo) colors = colorsFromImage(await imageOf(body.logo)) ?? colors;
        if (body.themeColor && /^#[0-9A-F]{6}$/i.test(body.themeColor)) colors = { ...colors, accent: body.themeColor.toUpperCase() };
        const noColour = colors === this.cfg.brand.colors;
        this.update((c) => {
          c.brand.name = body.name ?? c.brand.name;
          c.brand.website = body.website ?? c.brand.website;
          if (body.logo) c.brand.logo = body.logo;
          c.brand.colors = colors;
          if (c.title === defaultConfig().title && body.name) c.title = `${body.name} booth`;
        }, true);
        this.status(body.logo ? (noColour ? "Filled in. The logo has no colour of its own, so pick the colours below." : "Filled in. Check the logo and colours, and change anything that's off.") : "Filled in the name. No logo found: add one below.");
      } catch (e) {
        this.status(e instanceof Error ? e.message : "Couldn't read that website.", true);
      } finally {
        fetchBtn.disabled = false;
      }
    });

    const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", style: { display: "none" } });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      file.value = "";
      if (!f) return;
      try {
        const logo = await logoFromFile(f);
        this.update((c) => (c.brand.logo = logo), true);
        this.status("Logo added. Tap “Colours from logo” to match the colours.");
      } catch (e) {
        this.status(e instanceof Error ? e.message : "That picture couldn't be opened.", true);
      }
    });
    const fromLogo = h("button", { class: "small", disabled: !c.brand.logo }, "🎨 Colours from logo");
    fromLogo.addEventListener("click", async () => {
      if (!this.cfg.brand.logo) return;
      const colors = colorsFromImage(await imageOf(this.cfg.brand.logo));
      if (!colors) return this.status("The logo is black and white: pick the colours by hand.");
      this.update((c) => (c.brand.colors = colors), true);
    });

    return h(
      "div",
      { class: "card" },
      h("h3", null, "Brand"),
      endpoint ? h("div", { style: { display: "grid", gap: "8px" } }, h("label", { class: "field" }, "Website", h("span", { class: "hint" }, "Fills in the name, logo and colours from the site. Check them after."), site), fetchBtn) : null,
      h("div", { class: "grid2" }, this.input("Brand name", c.brand.name, LIMITS.name, (c, v) => (c.brand.name = v)), this.input("Website (for the frames)", c.brand.website, LIMITS.website, (c, v) => (c.brand.website = v), { type: "url", placeholder: "https://…" })),
      h(
        "div",
        { class: "row" },
        c.brand.logo ? h("img", { src: c.brand.logo, alt: "Logo", style: { height: "48px", maxWidth: "160px", objectFit: "contain", background: "rgba(255,255,255,.08)", borderRadius: "8px", padding: "4px" } }) : h("span", { class: "note" }, "No logo yet"),
        h("label", { class: "btn small" }, c.brand.logo ? "Change logo" : "Upload logo", file),
        c.brand.logo ? h("button", { class: "small", onclick: () => this.update((c) => (c.brand.logo = ""), true) }, "Remove") : null,
        fromLogo,
      ),
      h("div", { class: "row" }, this.color("Main colour", "accent"), this.color("Second colour", "highlight"), this.color("Background", "base"), this.color("Text", "text")),
      this.headingChoice(),
      this.check("Show the brand's logo on the frames", c.showBrand, (c, v) => (c.showBrand = v)),
      h("p", { class: "note" }, "Only use a brand's name and logo with the owner's OK."),
    );
  }

  private headingChoice() {
    const sel = h("select", { "aria-label": "Heading style" }, h("option", { value: "default", selected: this.cfg.brand.headingFont === "default" }, "Clean (Inter)"), h("option", { value: "condensed", selected: this.cfg.brand.headingFont === "condensed" }, "Bold condensed (Asap Condensed)"));
    sel.addEventListener("change", () => this.update((c) => (c.brand.headingFont = sel.value === "condensed" ? "condensed" : "default")));
    return h("label", { class: "field" }, "Heading style", h("span", { class: "hint" }, "The booth's title and buttons"), sel);
  }

  private frames() {
    const c = this.cfg;
    // a pack's frames only once the pack is on
    const all = listFrames().filter((f) => !f.pack || c.packs.includes(f.pack));
    const allowed = (id: string) => c.frames.allow === "all" || (c.frames.allow as string[]).includes(id);
    const packs = [...new Set(listFrames().map((f) => f.pack).filter((p): p is string => Boolean(p)))];
    const packChecks = packs.map((p) => this.check(`${p[0]!.toUpperCase()}${p.slice(1)} frames`, c.packs.includes(p), (c, v) => (c.packs = v ? [...new Set([...c.packs, p])] : c.packs.filter((x) => x !== p)), true));
    const grid = h("div", { class: "frames-grid" });
    for (const f of all) {
      const el = h("input", { type: "checkbox", checked: allowed(f.id) });
      el.addEventListener("change", () =>
        this.update((c) => {
          const now = new Set(c.frames.allow === "all" ? all.map((x) => x.id) : c.frames.allow);
          if (el.checked) now.add(f.id);
          else if (now.size > 1) now.delete(f.id);
          else el.checked = true;
          c.frames.allow = now.size === all.length ? "all" : [...now];
        }, true),
      );
      grid.appendChild(h("label", { class: "check" }, el, f.label));
    }
    const def = h("select", { "aria-label": "The frame it opens with" });
    for (const f of all.filter((f) => allowed(f.id))) def.appendChild(h("option", { value: f.id, selected: f.id === c.frames.default }, f.label));
    def.addEventListener("change", () => {
      this.previewFrame = def.value;
      this.update((c) => (c.frames.default = def.value as never), true);
    });
    return h(
      "details",
      { class: "card" },
      h("summary", null, `Frames (${c.frames.allow === "all" ? "all " + all.length : c.frames.allow.length})`),
      ...packChecks,
      h("label", { class: "field" }, "Opens with", def),
      h("div", { class: "row" }, h("button", { class: "small", onclick: () => this.update((c) => (c.frames.allow = "all"), true) }, "Tick all")),
      grid,
    );
  }

  private words() {
    const c = this.cfg;
    const rows = listWordSlots().map((s) => {
      const own = c.words[s.id];
      const mode = own?.mode ?? s.defaultMode;
      const text = h("input", { type: "text", value: own?.text ?? "", maxLength: s.max, placeholder: s.placeholder, disabled: mode === "off" });
      text.addEventListener("input", () => this.update((c) => (c.words[s.id] = { mode: c.words[s.id]?.mode ?? s.defaultMode, text: text.value })));
      const modes = h("div", { class: "modes", role: "group", "aria-label": s.label });
      for (const [m, label] of MODES) {
        modes.appendChild(
          h(
            "button",
            {
              class: "small",
              "aria-pressed": String(mode === m),
              style: mode === m ? { borderColor: "var(--qp-accent)" } : {},
              onclick: () => {
                this.previewFrame = s.frame;
                this.update((c) => (c.words[s.id] = { mode: m, text: c.words[s.id]?.text ?? "" }), true);
              },
            },
            label,
          ),
        );
      }
      return h("div", { class: "slot" }, h("strong", null, `${listFrames().find((f) => f.id === s.frame)?.label ?? s.frame} · ${s.label}`), modes, text, h("span", { class: "note" }, mode === "edit" ? "A starting text people can change." : mode === "fixed" ? "Always these words." : "Left off the frame."));
    });
    return h("details", { class: "card" }, h("summary", null, "Text on the frames"), h("p", { class: "note" }, "Fixed: your words. People write: they type their own (your text is the starting point). Off: left off."), ...rows);
  }

  private videoAndSharing() {
    const c = this.cfg;
    return h(
      "details",
      { class: "card" },
      h("summary", null, "Video, sharing and camera"),
      this.check("Let people make a video", c.video.enabled, (c, v) => (c.video.enabled = v)),
      this.check("QR code and link on the video's last card", c.video.qr, (c, v) => (c.video.qr = v)),
      this.check("Brand logo on the video's last card", c.video.showBrand, (c, v) => (c.video.showBrand = v)),
      this.input("Booth link", c.share.link, LIMITS.link, (c, v) => (c.share.link = v), { type: "url", placeholder: "https://…", hint: "Where people make their own (for the QR and “make yours”). https only." }),
      this.input("Share text", c.share.text, LIMITS.shareText, (c, v) => (c.share.text = v), { hint: "{link} is replaced by the booth link" }),
      h(
        "div",
        { class: "grid2" },
        this.input("Camera turns off after (seconds)", String(c.camera.idleSeconds), 3, (c, v) => (c.camera.idleSeconds = Number(v) || 30), { type: "number" }),
        this.input("Photos kept at once", String(c.maxPhotos), 2, (c, v) => (c.maxPhotos = Number(v) || 9), { type: "number" }),
      ),
      this.check("3-second countdown before each shot", c.camera.timer, (c, v) => (c.camera.timer = v)),
      this.check("Ask for a username (Telegram, X, Instagram), shown on every frame", c.person.handle.ask, (c, v) => (c.person.handle.ask = v)),
      this.check("Let people add their picture (upload, or their Telegram or X picture)", c.person.picture, (c, v) => (c.person.picture = v)),
      this.check("Show whole names (mafia names), not just the first word", c.person.wholeName, (c, v) => (c.person.wholeName = v)),
      this.check(`“${CREDIT_LINE}” on the frames and video`, c.credit, (c, v) => (c.credit = v)),
      h("p", { class: "note" }, "QuestPass Booth is free and open source. Keeping the credit on is how it stays that way."),
    );
  }

  private output() {
    const copy = h("button", { class: "small" }, "Copy");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(this.json.value);
        this.status("Copied.");
      } catch {
        this.json.select();
      }
    });
    const load = h("input", { type: "file", accept: "application/json,.json", style: { display: "none" } });
    load.addEventListener("change", async () => {
      const f = load.files?.[0];
      load.value = "";
      if (!f || f.size > 3_000_000) return;
      try {
        this.cfg = normalizeConfig(JSON.parse(await f.text()));
        this.previewFrame = this.cfg.frames.default;
        this.build();
        emit(this, "change", { config: this.config });
        this.status("Loaded.");
      } catch {
        this.status("That file isn't a booth's settings.", true);
      }
    });
    return h(
      "details",
      { class: "card" },
      h("summary", null, "Settings file (JSON)"),
      h("p", { class: "note" }, `Give this to <questpass-booth> (config attribute or config-src). Version ${CONFIG_VERSION}.`),
      this.json,
      h(
        "div",
        { class: "row" },
        copy,
        h("button", { class: "small", onclick: () => download(new Blob([this.json.value], { type: "application/json" }), `${slug(this.cfg.brand.name || this.cfg.title)}-booth.json`) }, "Download"),
        h("label", { class: "btn small" }, "Load a file", load),
        h("button", { class: "small", onclick: () => { this.cfg = defaultConfig(); this.build(); emit(this, "change", { config: this.config }); } }, "Start over"),
      ),
    );
  }

  private previewControls() {
    const frame = h("select", { "aria-label": "Preview frame" });
    for (const f of listFrames()) frame.appendChild(h("option", { value: f.id, selected: f.id === this.previewFrame }, f.label));
    frame.addEventListener("change", () => {
      this.previewFrame = frame.value;
      this.previewRatio = "";
      void this.preview();
    });
    const size = h("select", { "aria-label": "Preview size" }, h("option", { value: "" }, "Its usual size"), h("option", { value: "9:16" }, "Story 9:16"), h("option", { value: "4:5" }, "Post 4:5"), h("option", { value: "1:1" }, "Square"), h("option", { value: "16:9" }, "Wide 16:9"));
    size.addEventListener("change", () => {
      this.previewRatio = size.value as Ratio | "";
      void this.preview();
    });
    return h("div", { class: "grid2" }, h("label", { class: "field" }, "Preview", frame), h("label", { class: "field" }, "Size", size));
  }
}
