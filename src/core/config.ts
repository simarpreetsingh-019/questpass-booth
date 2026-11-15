/**
 * A booth's settings: one plain JSON object (BoothConfig) that the editor
 * makes and the booth reads. It is the stable, versioned interface between
 * the two and the host page: new fields are always optional with a default,
 * nothing is renamed or removed within a major version, and old configs are
 * migrated (see migrateConfig). normalizeConfig never throws: anything
 * missing, unknown or unsafe is dropped or replaced by its default.
 */
import { WORD_SLOTS } from "../engine/upstream/frame-words";
import { FRAME_IDS, type FrameId } from "../engine/upstream/frames";
import { isFrameId } from "./frames-meta";

export const CONFIG_VERSION = 1;

export type WordMode = "fixed" | "edit" | "off";
export type HeadingFont = "default" | "condensed";

export interface BoothColors {
  /** buttons, highlights, the frames' main colour */
  accent: string;
  /** a second colour: dates, stars */
  highlight: string;
  /** backdrop */
  base: string;
  /** text on the backdrop */
  text: string;
}

export interface BoothConfig {
  version: typeof CONFIG_VERSION;
  /** the booth's title on the frames and the video ("Global Pizza Party") */
  title: string;
  /** where ("Mumbai"); empty leaves it off */
  place: string;
  /** a date line under the title ("Sat 17 May 2026"); empty leaves it off */
  dates: string;
  brand: {
    /** the brand's name, shown when there's no logo */
    name: string;
    /** its website, for the frames that print an address */
    website: string;
    /** its logo: a data: image (made by the editor) or an https image URL that allows CORS; empty for none */
    logo: string;
    colors: BoothColors;
    /** the booth's own title and buttons: "default" (Inter) or "condensed" (Asap Condensed, heavy) */
    headingFont: HeadingFont;
  };
  /** show the brand's logo on the frames and the video's cards */
  showBrand: boolean;
  /** "made with QuestPass" on the frames and the video (please keep it on; see NOTICE) */
  credit: boolean;
  frames: {
    /** the frames people can pick, or all of them */
    allow: FrameId[] | "all";
    /** the one it opens with */
    default: FrameId;
  };
  /** the frames' text spaces, by id (see listWordSlots): fixed words, people write, or off */
  words: Record<string, { mode: WordMode; text: string }>;
  video: {
    /** let people make a video from their photos */
    enabled: boolean;
    /** a QR code and link on the video's last card (needs share.link) */
    qr: boolean;
    /** the brand's logo on the last card */
    showBrand: boolean;
  };
  share: {
    /** the words that go with a shared photo or video; {link} is replaced by share.link */
    text: string;
    /** the booth's own page, for "make yours" and the QR (https only); empty for none */
    link: string;
  };
  camera: {
    /** the camera turns itself off this many seconds after it's opened (10–120) */
    idleSeconds: number;
    /** a 3-second countdown before each shot */
    timer: boolean;
  };
  /** photos kept at once (1–20) */
  maxPhotos: number;
}

export const DEFAULT_COLORS: BoothColors = { accent: "#38FF9C", highlight: "#FFC440", base: "#0E0E0E", text: "#F5F5F0" };

export function defaultConfig(): BoothConfig {
  return {
    version: CONFIG_VERSION,
    title: "Photo booth",
    place: "",
    dates: "",
    brand: { name: "", website: "", logo: "", colors: { ...DEFAULT_COLORS }, headingFont: "default" },
    showBrand: true,
    credit: true,
    frames: { allow: "all", default: "polaroid" },
    words: {},
    video: { enabled: true, qr: true, showBrand: true },
    share: { text: "Made at the photo booth {link}", link: "" },
    camera: { idleSeconds: 30, timer: true },
    maxPhotos: 9,
  };
}

/** Limits on lengths, so a config can't blow up the layout or memory. */
export const LIMITS = { title: 40, place: 30, dates: 40, name: 40, website: 200, shareText: 280, link: 300, logoBytes: 1_500_000 } as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
/** Plain text: control characters removed, trimmed, cut to `max`. */
export const cleanText = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, " ").trim().slice(0, max) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);
export const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const color = (v: unknown, fallback: string) => (isColor(v) ? v.toUpperCase() : fallback);

/** An http(s) URL with no credentials in it, else "". */
export function cleanUrl(v: unknown, max: number = LIMITS.link, httpsOnly = false): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) return "";
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "https:" && (httpsOnly || u.protocol !== "http:")) return "";
    if (u.username || u.password) return "";
    return u.href;
  } catch {
    return "";
  }
}

/** A logo: a base64 PNG/JPEG/WebP/GIF data URL (not SVG: it can carry scripts) under the size limit, or an https URL. */
export function cleanLogo(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  if (v.startsWith("data:")) {
    return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(v) && v.length <= (LIMITS.logoBytes * 4) / 3 + 64 ? v : "";
  }
  return cleanUrl(v, 2000, true);
}

/** Bring an older config up to this version. */
export function migrateConfig(input: Obj): Obj {
  const out = { ...input };
  // version 0 (unversioned drafts): colours sat at the top level
  if (out.version === undefined && isObj(out.colors) && !isObj(out.brand)) {
    out.brand = { colors: out.colors };
    delete out.colors;
  }
  out.version = CONFIG_VERSION;
  return out;
}

/** Any input (JSON from anywhere) → a complete, safe BoothConfig. */
export function normalizeConfig(input: unknown): BoothConfig {
  const d = defaultConfig();
  if (!isObj(input)) return d;
  const c = migrateConfig(input);
  const brand = isObj(c.brand) ? c.brand : {};
  const colors = isObj(brand.colors) ? brand.colors : {};
  const frames = isObj(c.frames) ? c.frames : {};
  const video = isObj(c.video) ? c.video : {};
  const share = isObj(c.share) ? c.share : {};
  const camera = isObj(c.camera) ? c.camera : {};

  const allowList = Array.isArray(frames.allow) ? [...new Set(frames.allow.filter(isFrameId))] : null;
  const allow: FrameId[] | "all" = allowList && allowList.length && allowList.length < FRAME_IDS.length ? allowList : "all";
  const offered = allow === "all" ? FRAME_IDS : allow;
  const def = isFrameId(frames.default) && offered.includes(frames.default) ? frames.default : offered.includes(d.frames.default) ? d.frames.default : offered[0]!;

  const words: BoothConfig["words"] = {};
  if (isObj(c.words)) {
    for (const slot of WORD_SLOTS) {
      const w = c.words[slot.id];
      if (!isObj(w)) continue;
      const mode = w.mode === "fixed" || w.mode === "edit" || w.mode === "off" ? w.mode : slot.sponsor;
      words[slot.id] = { mode, text: cleanText(w.text, slot.max) };
    }
  }

  return {
    version: CONFIG_VERSION,
    title: cleanText(c.title, LIMITS.title, d.title),
    place: cleanText(c.place, LIMITS.place),
    dates: cleanText(c.dates, LIMITS.dates),
    brand: {
      name: cleanText(brand.name, LIMITS.name),
      website: cleanUrl(brand.website, LIMITS.website),
      logo: cleanLogo(brand.logo),
      colors: {
        accent: color(colors.accent, d.brand.colors.accent),
        highlight: color(colors.highlight, d.brand.colors.highlight),
        base: color(colors.base, d.brand.colors.base),
        text: color(colors.text, d.brand.colors.text),
      },
      headingFont: brand.headingFont === "condensed" ? "condensed" : "default",
    },
    showBrand: bool(c.showBrand, d.showBrand),
    credit: bool(c.credit, d.credit),
    frames: { allow, default: def },
    words,
    video: { enabled: bool(video.enabled, d.video.enabled), qr: bool(video.qr, d.video.qr), showBrand: bool(video.showBrand, d.video.showBrand) },
    share: { text: cleanText(share.text, LIMITS.shareText, d.share.text), link: cleanUrl(share.link, LIMITS.link, true) },
    camera: { idleSeconds: num(camera.idleSeconds, 10, 120, d.camera.idleSeconds), timer: bool(camera.timer, d.camera.timer) },
    maxPhotos: num(c.maxPhotos, 1, 20, d.maxPhotos),
  };
}

/** The frames this booth offers. */
export const offeredFrames = (c: BoothConfig): FrameId[] => (c.frames.allow === "all" ? [...FRAME_IDS] : c.frames.allow);

/** The text spaces, for an editor: id, which frame, label, length limit, what shows when empty, and the default mode. */
export const listWordSlots = () => WORD_SLOTS.map((s) => ({ id: s.id, frame: s.frame, label: s.label, max: s.max, placeholder: s.placeholder, defaultMode: s.sponsor as WordMode }));

/** The share text with the link filled in. */
export const shareTextOf = (c: BoothConfig) => (c.share.text.includes("{link}") ? c.share.text.replaceAll("{link}", c.share.link) : `${c.share.text} ${c.share.link}`).replace(/\s+/g, " ").trim();
