/**
 * The Journey Reel, drawn and recorded on the device (nothing is uploaded).
 *
 * Two layers, so any number of frames can wrap the same reel:
 *  1. The content (makeContent): a 6-second intro over the first photo (an
 *     old-film opening, who you are, your route to Mumbai) and the photos
 *     cut on the music's beat. It knows nothing about frames; it is drawn at
 *     whatever shape the frame's window has, so the photos always fill it.
 *  2. The frame (./frames): decoration and branding around that window, for
 *     the chosen output ratio. composeReel draws the frame, the content into
 *     its window, then the corner watermark, as the last step.
 * The first frame is the name slide, so the video's thumbnail is branded.
 */
import type { SponsorBrand } from "@/config/sponsors";
import { C, F, clamp, drawSponsorLogo, easeInOut, easeOut, loadFonts, text } from "@/features/recap/engine/draw-kit";
import { routeScene, type JourneyInput } from "@/features/journey/engine/render-journey";
import { drawFrame } from "@/features/recap/engine/gif-encoder";
import { beatSec, cutSteps, scheduleChest, scheduleCut, scheduleIntroSound, scheduleTrack, type IntroSound, type Track } from "./music";
import { loadBoothFonts } from "@/booth/fonts";
import { FRAMES, drawQr, sponsorLogo, type FrameBrand, type FrameCtx, type FrameId, type Palette, type Rect } from "./frames";

export type Ratio = "9:16" | "4:5" | "1:1" | "16:9";
export const RATIOS: Record<Ratio, [number, number]> = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080] };

export const INTRO_SEC = 6;
/**
 * the closing card: the photos zoom out to a wall, "My … recap, made with
 * QuestPass", the picture closes. Extra time on top of the 40 s / 90 s limit.
 */
export const OUTRO_SEC = 5;
/** the very first moment shows the finished name card, so the thumbnail apps take from the first frame is your pass, not black */
const POSTER_SEC = 0.12;
export const MAX_SEC = 40;
/** the "keep it longer" choice (X takes up to 140 s; Reels and Shorts up to 90 s and 60 s+) */
export const LONG_SEC = 90;
export const MAX_ITEMS = 20;
export const TEXT_MAX = 60;
export const CAPTION_MAX = 50;

/** Fill: cover the window (may crop). Whole: the whole photo, on a blurred copy of itself. Auto: whole when the shapes differ a lot. */
export type Fit = "auto" | "fill" | "whole";
export type Motion = "in" | "out" | "pan" | "still";

export interface ReelItem {
  id: string;
  image: ImageBitmap;
  /** how long it stays on screen, in beats of the track */
  beats: number;
  text: string;
  fit: Fit;
  motion: Motion;
  /** how far the motion zooms or pans, 0–0.4 */
  amount: number;
  /** what to zoom toward / keep in view, 0–1 across and down the photo */
  focus: { x: number; y: number };
  /** the day it was taken, YYYY-MM-DD (from the photo's EXIF, or set by hand); shown as a date stamp */
  date?: string;
  /** ⚡ a quick one: on screen for half its usual time */
  fast?: boolean;
  /** set by hand: how long it stays, in steps (quarter beats of the track), whatever the timing; unset follows the timing */
  hold?: number;
  /** how its text looks and where it sits (default: bold white on a dark box, near the bottom) */
  style?: CaptionStyle;
}

/* ------------------------------------------------------- caption styles */

export type CaptionFont = "bold" | "hand" | "marker" | "serif" | "poster" | "type";
export type CaptionColor = "white" | "accent" | "gold" | "marigold" | "pink" | "ink";
export interface CaptionStyle {
  font: CaptionFont;
  color: CaptionColor;
  /** the text's centre, 0–1 across and down the video (kept inside it) */
  pos?: { x: number; y: number };
}

/** The fonts: name, CSS family (for the picker), the canvas font, and a size factor so they look alike in size. */
export const CAPTION_FONTS: Record<CaptionFont, { label: string; css: string; font: (px: number) => string; k: number }> = {
  bold: { label: "Bold", css: "Inter, system-ui, sans-serif", font: (px) => F.sans(px, 800), k: 1 },
  hand: { label: "Handwritten", css: "Caveat, cursive", font: (px) => `700 ${px}px Caveat, cursive`, k: 1.5 },
  marker: { label: "Marker", css: "'Permanent Marker', cursive", font: (px) => `400 ${px}px "Permanent Marker", cursive`, k: 1.05 },
  serif: { label: "Classy", css: "'Playfair Display', Georgia, serif", font: (px) => `italic 800 ${px}px "Playfair Display", Georgia, serif`, k: 1.1 },
  poster: { label: "Poster", css: "'Bebas Neue', Impact, sans-serif", font: (px) => `400 ${px}px "Bebas Neue", Impact, sans-serif`, k: 1.4 },
  type: { label: "Typewriter", css: "'IBM Plex Mono', monospace", font: (px) => F.mono(px, 600), k: 0.9 },
};
/** Colours that sit with the site's theme (read when drawn, so they follow it). */
export const CAPTION_COLORS: Record<CaptionColor, () => string> = {
  white: () => "#FFFFFF",
  accent: () => C.neon,
  gold: () => C.gold,
  marigold: () => C.marigold,
  pink: () => "#FF8AD8",
  ink: () => "#111216",
};
export const DEFAULT_CAPTION: CaptionStyle = { font: "bold", color: "white" };

/** The extra caption fonts, served with the booth (no third-party font host), loaded once before drawing. */
let captionFonts: Promise<void> | null = null;
export function loadCaptionFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  captionFonts ??= loadBoothFonts().then(() =>
    Promise.all((["hand", "marker", "serif", "poster"] as CaptionFont[]).map((f) => document.fonts.load(CAPTION_FONTS[f].font(40)).catch(() => undefined))).then(() => undefined),
  );
  return captionFonts;
}

/** Everything the content layer needs (no frame, no ratio). */
export interface ContentInput {
  items: ReelItem[];
  track: Track;
  caption: string;
  journey: JourneyInput;
  eventName: string;
  /** shown under the name card ("Journey recap · powered by …") */
  sponsor: SponsorBrand;
  /**
   * How long each photo stays: "music" follows the track's own rhythm of cuts
   * (a different song cuts differently), "fast" the same at double speed,
   * "manual" each photo's own `beats`. Default manual.
   */
  timing?: Timing;
  /** the postcard's message (instead of "Side quests unlocked at …") */
  note?: string;
  /** this person's reel link, questpass.live/reel/<their QR code>: the QR on the closing card (and frames) */
  link?: string;
  /** how long the line after the pass (`caption`) stays, in seconds: it shows from the end of the intro over the first photo(s) */
  captionSec?: number;
  /** a booth outside the event (no pass): a title card instead of the pass and route, and a closing card without them */
  open?: OpenReel;
}

/** A video from a booth outside the event (/snap, a sponsor's /b/<name>). `eventName` is its title. */
export interface OpenReel {
  /** the date line under the title */
  dates: string;
  /** the booth's sponsor on the cards ("by <logo>"); the public booth has none */
  sponsor: boolean;
  /** "Made with QuestPass" on the closing card */
  credit: boolean;
  /** the closing card's QR and link (default shown) */
  outroQr?: boolean;
  /** the sponsor on the closing card (default: as `sponsor`) */
  outroSponsor?: boolean;
}

export type Timing = "music" | "fast" | "manual";

export interface ReelInput extends ContentInput {
  ratio: Ratio;
  frame: FrameId;
  eventDates: string;
  /** the sound under the intro */
  intro?: IntroSound;
  /** for frames that print numbers (the newspaper) */
  stats?: ReelStats;
  /** the frame's colours: one of its palettes (by number) or one made for it (from a photo); default its first */
  palette?: number | Palette;
  /** a booth outside the event: its own wording on the frames (see FrameCtx.brand) */
  brand?: FrameBrand;
  /** words for the frames' text spaces (see FrameCtx.words) */
  words?: Record<string, string>;
}

export interface ReelStats {
  /** passes pinned on the site */
  pins: number;
  countries: number;
  /** Indian states people came from */
  states: number;
  /** side events this person was stamped at */
  attended: number;
}

export interface Segment {
  item: ReelItem;
  /** a second photo beside (or under) the first: two tall photos in a wide reel, or two wide ones in a tall reel */
  pair?: ReelItem;
  index: number;
  start: number;
  end: number;
}

/** A photo whose shape fights the window's (tall in a wide reel, or wide in a tall one), left on auto fit. */
function crosswise(it: Pick<ReelItem, "fit" | "image">, aspect: number): boolean {
  if (it.fit !== "auto" || !aspect) return false;
  const a = it.image.width / it.image.height;
  return (aspect > 1.2 && a < 0.9) || (aspect < 0.85 && a > 1.15);
}

/**
 * When each photo plays (seconds from the start), the photos' end (where the
 * closing card starts) and the total length. With a window `aspect`, two
 * crosswise photos in a row share the screen side by side.
 */
/** The time one step (a quarter beat) of the track takes: photo lengths are whole steps, so cuts land on the music. */
export const stepSec = (track: Track) => beatSec(track) / 4;

/** How many steps photo `i` stays: set by hand, else by the timing (⚡ halves it). */
export function photoSteps(input: Pick<ContentInput, "items" | "track" | "timing">, i: number): number {
  const it = input.items[i]!;
  if (it.hold) return it.hold;
  const timing = input.timing ?? "manual";
  const pattern = cutSteps(input.track, timing === "fast");
  const steps = timing === "manual" ? it.beats * 4 : pattern[i % pattern.length]!;
  return it.fast ? Math.max(4, Math.ceil(steps / 2)) : steps;
}

export function planReel(input: Pick<ContentInput, "items" | "track" | "timing">, aspect = 0): { segments: Segment[]; total: number; photosEnd: number } {
  const step = stepSec(input.track);
  const len = (_it: ReelItem, i: number) => photoSteps(input, i) * step;
  let t = INTRO_SEC;
  const segments: Segment[] = [];
  const items = input.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const next = items[i + 1];
    const paired = next && crosswise(item, aspect) && crosswise(next, aspect);
    const d = len(item, i) + (paired ? len(next, i + 1) : 0);
    segments.push({ item, pair: paired ? next : undefined, index: segments.length, start: t, end: t + d });
    t += d;
    if (paired) i++;
  }
  return { segments, total: t + OUTRO_SEC, photosEnd: t };
}

/** A collectible touch per role: its emoji and colour on the name card and the closing card. */
export const ROLE_LOOK: Record<string, { emoji: string; color: string }> = {
  Developer: { emoji: "💻", color: "#4ADE80" },
  "Content creator": { emoji: "🎬", color: "#F472B6" },
  Marketing: { emoji: "📣", color: "#FB923C" },
  Business: { emoji: "💼", color: "#60A5FA" },
  Founder: { emoji: "🚀", color: "#FACC15" },
  GTM: { emoji: "🎯", color: "#A78BFA" },
};
const roleLook = (role: string) => ROLE_LOOK[role] ?? { emoji: "✨", color: C.gold };

/* ----------------------------------------------------------------- helpers */

type Img = CanvasImageSource & { width: number; height: number };

function cover(ctx: CanvasRenderingContext2D, img: Img, r: Rect, zoom = 1) {
  const s = Math.max(r.w / img.width, r.h / img.height) * zoom;
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

export function roundRect(ctx: CanvasRenderingContext2D, r: Rect, rad: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
}

/** Wrap `s` to at most `lines` lines of `maxW` (font already set). */
export function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number, lines = 2): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxW && cur) {
      out.push(cur);
      cur = word;
      if (out.length === lines) break;
    } else cur = next;
  }
  if (out.length < lines && cur) out.push(cur);
  return out.slice(0, lines);
}

/** A blurred copy (downscale then upscale: works everywhere, unlike canvas filters on Safari). */
function blurred(img: Img): HTMLCanvasElement {
  const small = document.createElement("canvas");
  small.width = 24;
  small.height = Math.max(1, Math.round((24 * img.height) / img.width));
  small.getContext("2d")!.drawImage(img, 0, 0, small.width, small.height);
  const big = document.createElement("canvas");
  big.width = 540;
  big.height = Math.round((540 * img.height) / img.width);
  const b = big.getContext("2d")!;
  b.imageSmoothingQuality = "high";
  b.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

/** A few frames of film grain to cycle through. */
function grainFrames(n = 4): HTMLCanvasElement[] {
  return Array.from({ length: n }, () => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 34;
    }
    g.putImageData(d, 0, 0);
    return c;
  });
}

/** Booths can show the whole name (a mafia name like "Chorizo Corleone") instead of the first word. */
let wholeNames = false;
export const setWholeNames = (on: boolean) => {
  wholeNames = on;
};
export const firstName = (n: string) => (wholeNames ? n.trim() : (n.trim().split(/\s+/)[0] ?? n));

/** Whether a photo shows whole (on its blurred self) in a window of this shape. */
export function showsWhole(item: Pick<ReelItem, "fit" | "image">, aspect: number): boolean {
  if (item.fit !== "auto") return item.fit === "whole";
  return Math.abs(Math.log(item.image.width / item.image.height / aspect)) > 0.35;
}

/* ------------------------------------------------------- layer 1: content */

export interface ContentRenderer {
  total: number;
  /** where the closing card starts */
  photosEnd: number;
  /** when the picture changes (each photo, and the closing card), for the cut sound and the timeline */
  cuts: number[];
  /** the date of the photo showing at t, for frames that print it themselves */
  dateAt(t: number): string | undefined;
  /** while a photo shows: which (of how many) and how far through it, for frames that count them */
  segAt(t: number): { i: number; n: number; p: number } | undefined;
  size: [number, number];
  /** The text the current moment carries (a photo's text, or the intro's headline), for frames that show it themselves. */
  textAt(t: number): string;
  /** Draw the content at time t into (0,0)–size; `labels: false` leaves photo text to the frame, `dates: false` the date stamp. */
  draw(ctx: CanvasRenderingContext2D, t: number, labels?: boolean, dates?: boolean): void;
}

/** The reel at `size` (the frame window's shape, any aspect). */
export async function makeContent(input: ContentInput, size: [number, number]): Promise<ContentRenderer> {
  await loadFonts();
  if (input.items.some((it) => it.style && it.style.font !== "bold" && it.style.font !== "type")) await loadCaptionFonts();
  const [CW, CH] = size;
  const R: Rect = { x: 0, y: 0, w: CW, h: CH };
  const m = Math.min(CW, CH);
  const { segments, total, photosEnd } = planReel(input, CW / CH);
  const first = input.items[0]!.image;
  const blur = blurred(first);
  const blurs = new Map<string, HTMLCanvasElement>();
  const blurOf = (it: ReelItem) => blurs.get(it.id) ?? blurs.set(it.id, blurred(it.image)).get(it.id)!;
  const grain = grainFrames();
  const route = routeScene(input.journey, true);
  const routeCanvas = document.createElement("canvas");
  routeCanvas.width = routeCanvas.height = 720;
  const rctx = routeCanvas.getContext("2d")!;
  const j = input.journey;
  const av = j.avatar;
  const open = input.open;

  /** Text over the photo: a dark rounded label, centred. */
  /**
   * Text over the photo, in its style: bold on a dark box (default), dark
   * ink on a white box, or the other fonts free with a soft shadow (the
   * handwritten ones a touch tilted). Placed where the person tapped, but
   * always kept inside the video, clear of its edges.
   */
  function label(ctx: CanvasRenderingContext2D, s: string, cy: number, px0: number, st: CaptionStyle = DEFAULT_CAPTION) {
    const def = CAPTION_FONTS[st.font] ?? CAPTION_FONTS.bold;
    const px = px0 * def.k;
    const font = def.font(px);
    ctx.font = font;
    const lines = wrap(ctx, s, CW * 0.84);
    const lh = px * (st.font === "poster" ? 1.0 : 1.2);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + px * 1.0;
    const h = lines.length * lh + px * 0.6;
    const gx = m * 0.03;
    const x = clamp(st.pos ? st.pos.x * CW : CW / 2, w / 2 + gx, CW - w / 2 - gx);
    const y = clamp(st.pos ? st.pos.y * CH : cy, h / 2 + CH * 0.06, CH - h / 2 - CH * 0.06);
    const ink = st.color === "ink";
    const boxed = st.font === "bold" || ink;
    ctx.save();
    if (st.font === "hand" || st.font === "marker") {
      ctx.translate(x, y);
      ctx.rotate(-0.04);
      ctx.translate(-x, -y);
    }
    if (boxed) {
      ctx.fillStyle = ink ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.62)";
      roundRect(ctx, { x: x - w / 2, y: y - h / 2, w, h }, px * 0.4);
      ctx.fill();
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = px * 0.3;
      ctx.shadowOffsetY = px * 0.06;
    }
    const color = (CAPTION_COLORS[st.color] ?? CAPTION_COLORS.white)();
    lines.forEach((l, i) => text(ctx, l, x, y - h / 2 + px * 0.3 + lh * (i + 0.5), font, color));
    ctx.restore();
  }

  /** Old film: grain, a scratch or two, flicker, vignette, a warm tint. `k` is the strength. */
  function vintage(ctx: CanvasRenderingContext2D, t: number, k: number) {
    if (k <= 0) return;
    const f = Math.floor(t * 24);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = "rgba(255,190,120,0.10)";
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = ctx.createPattern(grain[f % grain.length]!, "repeat")!;
    ctx.fillRect(0, 0, CW, CH);
    // scratches: thin vertical lines that jump about
    const r = Math.sin(f * 12.9898) * 43758.5453;
    const rand = r - Math.floor(r);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    if (rand > 0.4) ctx.fillRect(CW * rand, 0, 1.5, CH);
    if (rand > 0.75) ctx.fillRect(CW * (1 - rand) * 1.3, CH * 0.2, 1, CH * 0.6);
    // flicker
    ctx.fillStyle = `rgba(0,0,0,${0.08 + 0.08 * Math.abs(Math.sin(f * 1.7))})`;
    ctx.fillRect(0, 0, CW, CH);
    // vignette
    const g = ctx.createRadialGradient(CW / 2, CH / 2, m * 0.35, CW / 2, CH / 2, Math.hypot(CW, CH) / 1.6);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    ctx.restore();
  }

  const look = roleLook(j.role);
  /** "💻 DEVELOPER" in the role's colour: the collectible's class. */
  function rolePill(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const px = m * 0.03;
    const s = `${look.emoji} ${j.role.toUpperCase()}`;
    ctx.font = F.mono(px, 800);
    const w = ctx.measureText(s).width + px * 1.4;
    const h = px * 1.9;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, { x: cx - w / 2, y: cy - h / 2, w, h }, h / 2);
    ctx.fill();
    ctx.strokeStyle = look.color;
    ctx.lineWidth = Math.max(2, px * 0.12);
    ctx.stroke();
    text(ctx, s, cx, cy, F.mono(px, 800), look.color);
  }

  /** The projector's slit: the picture shows only a band `open` (0–1) of its height around the middle. */
  function slit(ctx: CanvasRenderingContext2D, open: number) {
    if (open >= 1) return;
    const half = (CH / 2) * open;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CW, CH / 2 - half);
    ctx.fillRect(0, CH / 2 + half, CW, CH / 2 - half);
  }

  function intro(ctx: CanvasRenderingContext2D, t: number) {
    // 4.6–6 s: the blur clears into the first photo
    const clear = clamp((t - 4.6) / 1.1);
    cover(ctx, blur, R, 1.1);
    ctx.fillStyle = `rgba(0,0,0,${0.5 * (1 - clear)})`;
    ctx.fillRect(0, 0, CW, CH);
    if (clear > 0) {
      ctx.globalAlpha = easeOut(clear);
      drawItem(ctx, input.items[0]!, 0, 0);
      ctx.globalAlpha = 1;
    }
    const cx = CW / 2;
    // 0–2.75 s: who you are (complete on the cover frame)
    const a = t < 2.4 ? 1 : 1 - clamp((t - 2.4) / 0.35);
    if (a > 0 && open) {
      // no pass: the title, their name, the day, the sponsor
      ctx.globalAlpha = a;
      ctx.font = F.display(m * 0.11, 900);
      const lines = wrap(ctx, input.eventName.toUpperCase() || "PHOTO BOOTH", CW * 0.84, 3);
      const lh = m * 0.12;
      const top = CH / 2 - ((lines.length - 1) * lh) / 2 - m * 0.06;
      text(ctx, "📸", cx, top - m * 0.16, F.sans(m * 0.09, 800), C.white);
      lines.forEach((l, i) => text(ctx, l, cx, top + i * lh, F.display(m * 0.11, 900), "#FFFFFF"));
      let y = top + (lines.length - 1) * lh + m * 0.11;
      if (j.name) {
        text(ctx, `with ${j.name}`, cx, y, F.sans(m * 0.05, 700), C.neon);
        y += m * 0.07;
      }
      if (open.dates) text(ctx, open.dates.toUpperCase(), cx, y, F.mono(m * 0.034, 700), "rgba(255,255,255,0.8)");
      if (open.sponsor) {
        const py = CH - m * 0.12;
        const ps = m * 0.032;
        ctx.font = F.sans(ps, 600);
        const ww = ctx.measureText("by ").width;
        const lh2 = ps * 1.6;
        const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d")!, input.sponsor, 0, 0, lh2);
        const x0 = cx - (ww + lw) / 2;
        text(ctx, "by ", x0, py, F.sans(ps, 600), "rgba(255,255,255,0.85)", "left");
        sponsorLogo(ctx, input.sponsor, x0 + ww, py - lh2 / 2, lh2);
      }
      ctx.globalAlpha = 1;
    } else if (a > 0) {
      ctx.globalAlpha = a;
      const d = m * 0.3;
      const ay = CH / 2 - m * 0.16;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, ay, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.clip();
      if (av.kind === "image") cover(ctx, av.image, { x: cx - d / 2, y: ay - d / 2, w: d, h: d });
      else text(ctx, av.kind === "emoji" ? av.emoji : av.kind === "initials" ? av.text : firstName(j.name).slice(0, 1).toUpperCase(), cx, ay, F.sans(d * 0.45, 800), C.white);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, ay, d / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = look.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      rolePill(ctx, cx, ay - d / 2 - m * 0.06);
      text(ctx, j.name, cx, ay + d / 2 + m * 0.09, F.sans(m * 0.075, 800), "#FFFFFF");
      if (j.handle) text(ctx, j.handle, cx, ay + d / 2 + m * 0.15, F.mono(m * 0.042, 600), "rgba(255,255,255,0.8)");
      // the boarding pass number, like the stub of the pass they pinned
      text(ctx, `🎫 ${j.ticket}`, cx, ay + d / 2 + m * 0.205, F.mono(m * 0.032, 700), C.gold);
      text(ctx, `My ${input.eventName} journey recap ✈️`, cx, ay + d / 2 + m * 0.275, F.sans(m * 0.048, 700), C.neon);
      // lower centre: whose recap this is
      const py = CH - m * 0.12;
      const ps = m * 0.032;
      const words = "Recap powered by ";
      ctx.font = F.sans(ps, 600);
      const ww = ctx.measureText(words).width;
      const lh = ps * 1.6;
      const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d")!, input.sponsor, 0, 0, lh);
      const x0 = cx - (ww + lw) / 2;
      text(ctx, words, x0, py, F.sans(ps, 600), "rgba(255,255,255,0.85)", "left");
      sponsorLogo(ctx, input.sponsor, x0 + ww, py - lh / 2, lh);
      ctx.globalAlpha = 1;
    }
    // 2.2–4.8 s: the Journey GIF's travel map (plane, train or car along the route), see-through over the photo
    const rk = open ? 0 : Math.min(clamp((t - 2.15) / 0.35), 1 - clamp((t - 4.5) / 0.35));
    if (rk > 0) {
      drawFrame(rctx, route, Math.min(route.frames - 1, Math.floor(clamp((t - 2.2) / 2.4) * route.frames)), 720);
      const s = Math.min(CW, CH) * 1.0;
      ctx.globalAlpha = rk;
      ctx.drawImage(routeCanvas, (CW - s) / 2, (CH - s) / 2, s, s);
      ctx.globalAlpha = 1;
    }
    const cap = clamp((t - 5.1) / 0.45);
    if (cap > 0 && input.caption.trim()) {
      ctx.globalAlpha = cap;
      label(ctx, input.caption.trim(), CH * 0.8, m * 0.06);
      ctx.globalAlpha = 1;
    }
    // old film while the name card shows (to ~2.4 s), then fading out slowly
    vintage(ctx, t, 1 - clamp((t - 2.4) / 1.8));
    // the projector opening: the picture opens out from a slit across the middle
    slit(ctx, easeInOut(clamp((t - POSTER_SEC) / 1.2)));
  }

  const segAt = (t: number) => segments.find((s) => t < s.end) ?? segments[segments.length - 1]!;
  // the line after the pass: in at 5.1 s, out after `captionSec` (at least as long as the intro left it, ~0.9 s)
  const capLine = input.caption.trim();
  const capEnd = 5.1 + Math.max(0.9, input.captionSec ?? 0.9);

  /** A photo at progress p (0–1) of its time, with its fit, motion and focus. */
  function drawItem(ctx: CanvasRenderingContext2D, it: ReelItem, p: number, dir: number, r: Rect = R, cell = false) {
    const e = easeInOut(p);
    const z = it.motion === "in" ? 1 + it.amount * e : it.motion === "out" ? 1 + it.amount * (1 - e) : it.motion === "pan" ? 1 + Math.max(0.12, it.amount) : 1;
    const whole = !cell && showsWhole(it, r.w / r.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (whole) {
      cover(ctx, blurOf(it), r, 1.15);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    const base = whole ? Math.min(r.w / it.image.width, r.h / it.image.height) : Math.max(r.w / it.image.width, r.h / it.image.height);
    const s = base * z;
    const w = it.image.width * s;
    const h = it.image.height * s;
    // keep the focus point where it sits in the photo; a pan glides across toward it
    const fx = it.focus.x;
    const fy = it.focus.y;
    const x = w > r.w ? clamp(r.w / 2 - fx * w + (fx - 0.5) * r.w, r.w - w, 0) : (r.w - w) / 2;
    const y = h > r.h ? clamp(r.h / 2 - fy * h + (fy - 0.5) * r.h, r.h - h, 0) : (r.h - h) / 2;
    if (it.motion === "pan" && w > r.w) {
      // glide from one side to the other, ending on the focus
      const from = dir > 0 ? 0 : r.w - w;
      ctx.drawImage(it.image, r.x + from + (x - from) * e, r.y + y, w, h);
    } else ctx.drawImage(it.image, r.x + x, r.y + y, w, h);
    ctx.restore();
  }

  /** A segment's picture: one photo, or two side by side (the second slides in a moment after the first). */
  function drawSeg(ctx: CanvasRenderingContext2D, seg: Segment, t: number) {
    const p = clamp((t - seg.start) / (seg.end - seg.start));
    const dir = seg.index % 2 ? -1 : 1;
    if (!seg.pair) return drawItem(ctx, seg.item, p, dir);
    const wide = CW > CH;
    const g = m * 0.012;
    const a: Rect = wide ? { x: 0, y: 0, w: (CW - g) / 2, h: CH } : { x: 0, y: 0, w: CW, h: (CH - g) / 2 };
    const b: Rect = wide ? { ...a, x: a.w + g } : { ...a, y: a.h + g };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CW, CH);
    drawItem(ctx, seg.item, p, dir, a, true);
    const k = easeOut(clamp((t - seg.start - 0.3) / 0.45));
    if (k <= 0) return;
    const off = (1 - k) * (wide ? b.w : b.h) * 0.35;
    ctx.save();
    ctx.globalAlpha *= k;
    drawItem(ctx, seg.pair, p, -dir, wide ? { ...b, x: b.x + off } : { ...b, y: b.y + off }, true);
    ctx.restore();
  }

  /** An old film camera's orange date stamp, bottom left: '26 11 04 */
  function dateStamp(ctx: CanvasRenderingContext2D, iso: string) {
    const [y, mo, d] = iso.split("-");
    if (!y || !mo || !d) return;
    const px = m * 0.04;
    ctx.save();
    ctx.shadowColor = "rgba(255,120,40,0.9)";
    ctx.shadowBlur = px * 0.5;
    text(ctx, `'${y.slice(2)} ${mo} ${d}`, m * 0.05, CH - m * 0.05, F.mono(px, 700), "#FF9A3C", "left");
    ctx.restore();
  }

  const dateOf = (seg: Segment) => seg.item.date ?? seg.pair?.date;
  const textOf = (seg: Segment) => seg.item.text.trim() || seg.pair?.text.trim() || "";
  const styleOf = (seg: Segment) => (seg.item.text.trim() ? seg.item.style : seg.pair?.style);

  function photos(ctx: CanvasRenderingContext2D, t: number, labels: boolean, dates: boolean) {
    const seg = segAt(t);
    const prev = segments[seg.index - 1];
    const fade = clamp((t - seg.start) / 0.22);
    if (prev && fade < 1) drawSeg(ctx, prev, t);
    ctx.globalAlpha = prev ? fade : 1;
    drawSeg(ctx, seg, t);
    ctx.globalAlpha = 1;
    const date = dateOf(seg);
    if (dates && date) {
      ctx.globalAlpha = clamp((t - seg.start) / 0.3);
      dateStamp(ctx, date);
      ctx.globalAlpha = 1;
    }
    // the line after the pass stays over the first photo(s) as long as asked; the photo's own text waits for it
    // (frames that print the text themselves get it from textAt instead)
    const capA = labels && capLine && t < capEnd ? clamp((capEnd - t) / 0.3) : 0;
    if (labels && textOf(seg)) {
      ctx.globalAlpha = Math.min(clamp((t - seg.start) / 0.3), clamp((t - capEnd) / 0.3));
      if (ctx.globalAlpha > 0) label(ctx, textOf(seg), CH * 0.84, m * 0.055, styleOf(seg));
      ctx.globalAlpha = 1;
    }
    if (capA > 0) {
      ctx.globalAlpha = capA;
      label(ctx, capLine, CH * 0.8, m * 0.06);
      ctx.globalAlpha = 1;
    }
  }

  /** Every photo pinned to a wall (made once): the closing card's background. */
  let wall: { c: HTMLCanvasElement; last: Rect } | null = null;
  function makeWall() {
    const c = document.createElement("canvas");
    c.width = CW;
    c.height = CH;
    const g = c.getContext("2d")!;
    g.fillStyle = "#16120F";
    g.fillRect(0, 0, CW, CH);
    const n = input.items.length;
    const cols = Math.max(1, Math.round(Math.sqrt((n * CW) / CH)));
    const rows = Math.ceil(n / cols);
    const cw = CW / cols;
    const ch = CH / rows;
    let last: Rect = R;
    input.items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // the last row centred
      const inRow = row === rows - 1 ? n - row * cols : cols;
      const x0 = (CW - inRow * cw) / 2 + col * cw;
      const pad = Math.min(cw, ch) * 0.08;
      const cell: Rect = { x: x0 + pad, y: row * ch + pad, w: cw - pad * 2, h: ch - pad * 2 };
      // a white border like a print, a slight turn each
      const turn = (((i * 7919) % 13) / 13 - 0.5) * 0.12;
      g.save();
      g.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
      g.rotate(turn);
      g.translate(-(cell.x + cell.w / 2), -(cell.y + cell.h / 2));
      g.shadowColor = "rgba(0,0,0,0.6)";
      g.shadowBlur = pad;
      g.fillStyle = "#F4EFE6";
      g.fillRect(cell.x - pad * 0.35, cell.y - pad * 0.35, cell.w + pad * 0.7, cell.h + pad * 0.7);
      g.shadowBlur = 0;
      drawItem(g, it, 1, 1, cell, true);
      g.restore();
      if (i === n - 1) last = cell;
    });
    return { c, last };
  }

  /**
   * The closing card (not blurred, like the opening): the last photo zooms
   * out to a wall of all of them, then "My … recap · made with QuestPass ·
   * powered by …", and the picture closes to a slit.
   */
  function outro(ctx: CanvasRenderingContext2D, t: number) {
    const u = t - photosEnd;
    wall ??= makeWall();
    const k = easeInOut(clamp(u / 0.8));
    const L = wall.last;
    const s0 = Math.max(CW / L.w, CH / L.h);
    // after the zoom out, a slow push in while the card holds
    const s = (s0 + (1 - s0) * k) * (1 + 0.06 * easeInOut(clamp((u - 0.8) / (OUTRO_SEC - 0.8))));
    const cx = L.x + L.w / 2 + (CW / 2 - (L.x + L.w / 2)) * k;
    const cy = L.y + L.h / 2 + (CH / 2 - (L.y + L.h / 2)) * k;
    ctx.save();
    ctx.translate(CW / 2, CH / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.drawImage(wall.c, 0, 0);
    ctx.restore();
    // the last photo as it was, fading into its print on the wall
    const last = segments[segments.length - 1];
    const stay = 1 - clamp(u / 0.35);
    if (last && stay > 0) {
      ctx.globalAlpha = stay;
      drawSeg(ctx, last, t);
      ctx.globalAlpha = 1;
    }
    const a = clamp((u - 0.6) / 0.35);
    if (a > 0) {
      ctx.fillStyle = `rgba(0,0,0,${0.66 * a})`;
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = a;
      // the card is laid out as one block from its top, then centred and
      // shrunk to fit short windows (it used to run into "Make yours")
      ctx.font = F.sans(m * 0.068, 800);
      const head = wrap(ctx, open ? input.eventName || "My photos" : `My ${input.eventName} recap`, CW * 0.86, 2);
      const d = m * 0.17;
      const ay = d / 2;
      const hy = d + m * 0.09;
      const y2 = hy + (head.length - 1) * m * 0.08 + m * 0.085;
      const y3 = y2 + m * 0.135;
      const y4 = y3 + m * 0.075;
      // the QR to their reel link (scan to connect, then make your own)
      const showQr = Boolean(input.link) && open?.outroQr !== false;
      const q = showQr ? m * 0.2 : 0;
      const qy = y4 + m * 0.06;
      const y5 = showQr ? qy + q + m * 0.06 : y4 + m * 0.08;
      const blockH = y5 + m * 0.03;
      const k = Math.min(1, (CH * 0.92) / blockH);
      ctx.save();
      ctx.translate(CW / 2, CH / 2);
      ctx.scale(k, k);
      ctx.translate(-CW / 2, -blockH / 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(CW / 2, ay, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.clip();
      if (av.kind === "image") cover(ctx, av.image, { x: CW / 2 - d / 2, y: ay - d / 2, w: d, h: d });
      else text(ctx, av.kind === "emoji" ? av.emoji : av.kind === "initials" ? av.text : firstName(j.name).slice(0, 1).toUpperCase(), CW / 2, ay, F.sans(d * 0.45, 800), C.white);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(CW / 2, ay, d / 2 + 3, 0, Math.PI * 2);
      ctx.strokeStyle = look.color;
      ctx.lineWidth = 5;
      ctx.stroke();
      head.forEach((l, i) => text(ctx, l, CW / 2, hy + i * m * 0.08, F.sans(m * 0.068, 800), "#FFFFFF"));
      if (open) {
        if (j.name) text(ctx, j.name, CW / 2, y2, F.sans(m * 0.042, 700), C.neon);
        if (open.dates) text(ctx, open.dates.toUpperCase(), CW / 2, y2 + m * 0.06, F.mono(m * 0.026, 700), C.gold);
      } else {
        rolePill(ctx, CW / 2, y2);
        text(ctx, `BOARDING PASS · ${j.ticket}`, CW / 2, y2 + m * 0.06, F.mono(m * 0.026, 700), C.gold);
      }
      // made with QuestPass · powered by the sponsor
      const ps = m * 0.036;
      ctx.font = F.sans(ps, 600);
      const w1 = ctx.measureText("Made with ").width;
      ctx.font = F.sans(ps, 800);
      const w2 = ctx.measureText("QuestPass").width;
      if (!open || open.credit) {
        text(ctx, "Made with ", CW / 2 - (w1 + w2) / 2, y3, F.sans(ps, 600), "rgba(255,255,255,0.85)", "left");
        text(ctx, "QuestPass", CW / 2 - (w1 + w2) / 2 + w1, y3, F.sans(ps, 800), C.neon, "left");
      }
      if (!open || (open.sponsor && open.outroSponsor !== false)) {
        const lh = ps * 1.6;
        const by = open ? "by " : "powered by ";
        ctx.font = F.sans(ps * 0.9, 600);
        const pw = ctx.measureText(by).width;
        const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d")!, input.sponsor, 0, 0, lh);
        const x0 = CW / 2 - (pw + lw) / 2;
        // with no "Made with" line, the sponsor takes its place
        const sy = open && !open.credit ? y3 : y4;
        text(ctx, by, x0, sy, F.sans(ps * 0.9, 600), "rgba(255,255,255,0.75)", "left");
        sponsorLogo(ctx, input.sponsor, x0 + pw, sy - lh / 2, lh);
      }
      // the QR fades in for the last 3 s of the video (its place is kept, so nothing jumps)
      const qa = clamp((t - (total - 3)) / 0.5);
      if (showQr && qa > 0) {
        ctx.save();
        ctx.globalAlpha *= qa;
        const pad = q * 0.08;
        ctx.fillStyle = "#FFFFFF";
        roundRect(ctx, { x: CW / 2 - q / 2 - pad, y: qy - pad, w: q + pad * 2, h: q + pad * 2 }, pad * 1.5);
        ctx.fill();
        drawQr(ctx, input.link!, CW / 2 - q / 2, qy, q, "#111216", { round: true, accent: look.color, avatar: av.kind === "image" ? av.image : undefined, letter: firstName(j.name).slice(0, 1).toUpperCase() });
        ctx.restore();
      }
      const shown = (input.link ?? `https://${j.siteHost}/reel`).replace(/^https?:\/\//, "");
      if (!open || showQr) text(ctx, open ? `Make yours · ${shown}` : input.link ? `Scan to connect · ${shown}` : `Make yours · ${shown}`, CW / 2, y5, F.mono(m * 0.03, 700), "rgba(255,255,255,0.75)");
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // the projector closing, like the opening in reverse
    slit(ctx, 1 - easeInOut(clamp((u - (OUTRO_SEC - 0.55)) / 0.5)));
  }

  return {
    total,
    photosEnd,
    size,
    cuts: [...segments.map((s) => s.start), photosEnd],
    dateAt: (t) => (t >= INTRO_SEC && t < photosEnd ? dateOf(segAt(t)) : undefined),
    segAt(t) {
      if (t < INTRO_SEC || t >= photosEnd) return undefined;
      const sg = segAt(t);
      return { i: Math.max(0, input.items.indexOf(sg.item)), n: input.items.length, p: clamp((t - sg.start) / Math.max(0.01, sg.end - sg.start)) };
    },
    textAt(t) {
      if (t < INTRO_SEC) return open ? input.eventName : `${firstName(j.name)} lands in Mumbai`;
      if (t >= photosEnd) return open && !open.credit ? input.eventName : `Made with QuestPass`;
      if (capLine && t < capEnd) return capLine;
      return textOf(segAt(t)) || input.caption.trim() || (open ? input.eventName : `${firstName(j.name)}'s ${input.eventName}`);
    },
    draw(ctx, t, labels = true, dates = true) {
      ctx.save();
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CW, CH);
      if (t < POSTER_SEC) intro(ctx, 2);
      else if (t < INTRO_SEC) intro(ctx, t);
      else if (t < photosEnd) photos(ctx, t, labels, dates);
      else outro(ctx, t);
      ctx.restore();
    },
  };
}

/* ------------------------------------------------- layer 2: frame (last) */

export interface Composer {
  size: [number, number];
  total: number;
  cuts: number[];
  draw(ctx: CanvasRenderingContext2D, t: number): void;
}

type FrameOpts = Pick<ReelInput, "ratio" | "frame" | "sponsor" | "eventName" | "eventDates" | "journey" | "stats" | "link" | "note" | "palette" | "brand" | "words"> & Partial<Pick<ReelInput, "items">>;

/** The frame's colours for these options: the palette given, or the frame's numbered (default first) one. */
export function framePalette(frame: FrameId, palette?: number | Palette): Palette {
  if (palette && typeof palette === "object") return palette;
  const all = FRAMES[frame].palettes();
  return all[palette ?? 0] ?? all[0]!;
}

/** The window the reel fills for this frame and ratio. */
export function reelWindow(opts: Pick<ReelInput, "ratio" | "frame">): Rect {
  const [W, H] = RATIOS[opts.ratio];
  const r = FRAMES[opts.frame].window(W, H, Math.min(W, H) / 1080);
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
}

/** Make the content at the frame's window shape and wrap it in the frame. */
export async function buildReel(input: ReelInput): Promise<Composer> {
  const R = reelWindow(input);
  return composeReel(await makeContent(input, [R.w, R.h]), input);
}

/** Wrap a content layer (made at reelWindow's size) in its frame. */
export function composeReel(content: ContentRenderer, opts: FrameOpts): Composer {
  const [W, H] = RATIOS[opts.ratio];
  const frame = FRAMES[opts.frame];
  const R = reelWindow(opts);
  const layer = document.createElement("canvas");
  [layer.width, layer.height] = content.size;
  const lctx = layer.getContext("2d")!;
  const m = Math.min(R.w, R.h);

  /**
   * Branding that slides in for 2 s every 5 s, then is gone: "SIDE QUEST"
   * top left, the event top right, the sponsor's logo bottom right, each
   * only where the frame leaves that part of the picture free.
   */
  const corners = frame.marks ?? ["br", "tl", "bl", "tr"];
  // read when first drawn (the colours that follow the site's theme are set by then)
  let pal: Palette | undefined;
  const photos = opts.items?.map((it) => it.image);
  const s = Math.max(16, m * 0.028);
  function badge(ctx: CanvasRenderingContext2D, t: number) {
    if (t < INTRO_SEC + 2 || t > content.photosEnd || !corners.length) return;
    const p = (t - INTRO_SEC - 2) % 5;
    if (p > 2) return;
    // fades and slides in from its edge over 0.45 s, holds, slides back out
    const a = easeInOut(Math.min(1, p / 0.45, (2 - p) / 0.45));
    const pad = Math.max(14, m * 0.03);
    const slide = (1 - a) * pad * 1.2;
    ctx.save();
    ctx.globalAlpha = 0.88 * a;
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = s * 0.5;
    const brand = opts.brand;
    if (corners.includes("tl") && (!brand || brand.mark)) text(ctx, brand ? brand.mark.toUpperCase() : "SIDE QUEST", R.x + pad - slide, R.y + pad + s / 2, F.mono(s, 800), "#FFFFFF", "left");
    if (corners.includes("tr")) text(ctx, opts.eventName.toUpperCase(), R.x + R.w - pad + slide, R.y + pad + s / 2, F.mono(s, 800), "#FFFFFF", "right");
    // the sponsor bottom right (the photo's date stamp has the bottom left)
    if (corners.includes("br") && (!brand || brand.sponsor)) {
      const lh = s * 1.3;
      const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d")!, opts.sponsor, 0, 0, lh);
      ctx.shadowBlur = 0;
      sponsorLogo(ctx, opts.sponsor, R.x + R.w - pad - lw + slide, R.y + R.h - pad - lh, lh);
    }
    ctx.restore();
  }

  return {
    size: [W, H],
    total: content.total,
    cuts: content.cuts,
    draw(ctx, t) {
      content.draw(lctx, t, !frame.ownsText, !frame.ownsDate);
      // the name card (to ~2.75 s) and the closing card carry the sponsor and QuestPass themselves
      const promo = Math.max(t < 2.4 ? 1 : 1 - clamp((t - 2.4) / 0.45), clamp((t - content.photosEnd - 0.5) / 0.4));
      pal ??= framePalette(opts.frame, opts.palette);
      const fc: FrameCtx = { ...opts, W, H, R, u: Math.min(W, H) / 1080, t, total: content.total, text: content.textAt(t), date: content.dateAt(t), promo, pal, photos, seg: content.segAt(t) };
      ctx.save();
      frame.back(ctx, fc);
      ctx.save();
      if (frame.tilt) {
        ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
        ctx.rotate(frame.tilt);
        ctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));
      }
      ctx.drawImage(layer, R.x, R.y, R.w, R.h);
      badge(ctx, t);
      ctx.restore();
      frame.front?.(ctx, fc);
      const end = clamp((t - (content.total - 0.3)) / 0.3);
      if (end > 0) {
        ctx.fillStyle = `rgba(0,0,0,${end})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    },
  };
}

/** The name slide (frame 0) as an image: the cover for platforms that let you pick one. */
export async function renderCover(input: ReelInput): Promise<Blob> {
  const r = await buildReel(input);
  const c = document.createElement("canvas");
  [c.width, c.height] = r.size;
  // just after the opening, so the cover is the full name slide
  r.draw(c.getContext("2d")!, 1.6);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("cover failed"))), "image/jpeg", 0.92));
}

/**
 * A still of a frame around one photo, for the template picker: no intro,
 * no music, just the frame's back, the photo in its window and its front,
 * as they look a few seconds into the photos. `canvas` is sized to `width`.
 */
export function previewFrame(canvas: HTMLCanvasElement, width: number, opts: FrameOpts & { photo?: ImageBitmap; text: string }) {
  const [W, H] = RATIOS[opts.ratio];
  const frame = FRAMES[opts.frame];
  const R = reelWindow(opts);
  const s = width / W;
  canvas.width = Math.round(W * s);
  canvas.height = Math.round(H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.scale(s, s);
  const n = Math.max(1, opts.items?.length ?? 1);
  const fc: FrameCtx = {
    ...opts,
    W,
    H,
    R,
    u: Math.min(W, H) / 1080,
    t: 9,
    total: 30,
    promo: 0,
    pal: framePalette(opts.frame, opts.palette),
    photos: opts.items?.map((it) => it.image),
    seg: { i: 0, n, p: 0.5 },
  };
  frame.back(ctx, fc);
  ctx.save();
  if (frame.tilt) {
    ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
    ctx.rotate(frame.tilt);
    ctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));
  }
  ctx.beginPath();
  ctx.rect(R.x, R.y, R.w, R.h);
  ctx.clip();
  ctx.fillStyle = "#222";
  ctx.fillRect(R.x, R.y, R.w, R.h);
  const img = opts.photo;
  if (img) {
    const k = Math.max(R.w / img.width, R.h / img.height);
    ctx.drawImage(img, R.x + (R.w - img.width * k) / 2, R.y + (R.h - img.height * k) / 2, img.width * k, img.height * k);
  }
  ctx.restore();
  frame.front?.(ctx, fc);
  ctx.restore();
}

/** The best video type this browser records: MP4 where possible (Instagram and X take it), else WebM. */
export function recordType(): string {
  // avc3 first: it repeats the H.264 setup inside the stream, so if the encoder
  // changes it part-way the whole video still plays (with avc1 the file has one
  // setup at the top, and X and Instagram stopped the video at the change)
  // (the fallback recorder; avc1 first again: apps like X want it, and the
  // canvas readback that made Chrome change the stream part-way is gone)
  const types = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc3.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

/**
 * "high": ~12 Mbps at 1080×1920, sharp photos (about 45 MB for 30 s; apps
 * re-compress on upload anyway). "small": ~5 Mbps (about 20 MB for 30 s).
 */
export type Quality = "high" | "small";
const bitrate = ([w, h]: [number, number], q: Quality) =>
  q === "high" ? Math.round(Math.min(14_000_000, Math.max(8_000_000, w * h * 6))) : Math.round(Math.min(6_000_000, Math.max(2_500_000, w * h * 2.4)));

export function scheduleSound(ctx: BaseAudioContext, out: AudioNode, track: Track, start: number, total: number, cuts: number[] = [], intro: IntroSound = "takeoff", frame?: FrameId) {
  // the game card opens with a chest (see frames.ts): its whoosh and burst
  if (frame === "gamecard") scheduleChest(ctx, out, start + 0.12, start + 1.2);
  // the intro has its own sound; the track comes in as it ends
  scheduleIntroSound(ctx, out, intro, start, INTRO_SEC);
  scheduleTrack(ctx, out, track, start, total, INTRO_SEC, INTRO_SEC - 1.2);
  for (const c of cuts) scheduleCut(ctx, out, start + c);
}

/**
 * Make the reel file: a standard MP4 (H.264 + AAC, one complete file with
 * its index at the start, like a phone camera's) built frame by frame with
 * the browser's encoders, faster than real time. X, Instagram Stories and
 * LinkedIn take that kind of file; the browser's recorder makes a streamed
 * MP4 some of them refuse. Browsers without those encoders record in real
 * time instead (recordRealtime).
 */
export async function recordReel(input: ReelInput, canvas: HTMLCanvasElement, onProgress: (sec: number, total: number) => void, signal?: AbortSignal, quality: Quality = "high"): Promise<{ blob: Blob; type: string }> {
  const fast = await encodeReel(input, canvas, onProgress, signal, quality);
  return fast ?? recordRealtime(input, canvas, onProgress, signal, quality);
}

const FPS = 30;

/** The first H.264 setup this browser can encode at this size (high, main, baseline). */
async function videoConfig(w: number, h: number, bitrate: number): Promise<VideoEncoderConfig | null> {
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42e028", "avc1.42001f"]) {
    const c: VideoEncoderConfig = { codec, width: w, height: h, bitrate, framerate: FPS, avc: { format: "avc" } };
    try {
      if ((await VideoEncoder.isConfigSupported(c)).supported) return c;
    } catch {
      // try the next
    }
  }
  return null;
}

async function encodeReel(input: ReelInput, canvas: HTMLCanvasElement, onProgress: (sec: number, total: number) => void, signal: AbortSignal | undefined, quality: Quality): Promise<{ blob: Blob; type: string } | null> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined" || typeof VideoFrame === "undefined" || typeof OfflineAudioContext === "undefined") return null;
  const r = await buildReel(input);
  const [w, h] = r.size;
  const vcfg = await videoConfig(w, h, bitrate(r.size, quality));
  const sampleRate = 48000;
  const acfg: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate, numberOfChannels: 2, bitrate: quality === "high" ? 192_000 : 128_000 };
  let audioOk = false;
  try {
    audioOk = Boolean((await AudioEncoder.isConfigSupported(acfg)).supported);
  } catch {
    audioOk = false;
  }
  // without AAC, X and Instagram would refuse the file: use the recorder instead
  if (!vcfg || !audioOk) return null;

  // the sound, rendered at once (it's all made in code, so no need to play it)
  const off = new OfflineAudioContext(2, Math.ceil(sampleRate * r.total), sampleRate);
  scheduleSound(off, off.destination, input.track, 0, r.total, r.cuts, input.intro, input.frame);
  const sound = await off.startRendering();

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h, frameRate: FPS },
    audio: { codec: "aac", sampleRate, numberOfChannels: 2 },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failed: unknown = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (failed = e) });
  venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (failed = e) });
  aenc.configure(acfg);

  [canvas.width, canvas.height] = r.size;
  const ctx = canvas.getContext("2d")!;
  let lock: WakeLockSentinel | null = null;
  try {
    lock = (await navigator.wakeLock?.request("screen")) ?? null;
  } catch {
    // no wake lock
  }
  try {
    const frames = Math.ceil(r.total * FPS);
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
      if (failed) throw failed;
      const t = i / FPS;
      r.draw(ctx, t);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      // don't run ahead of the encoder (keeps memory low on phones), and let the page breathe
      while (venc.encodeQueueSize > 6) await new Promise((res) => setTimeout(res, 4));
      if (i % 3 === 0) {
        onProgress(t, r.total);
        await new Promise((res) => setTimeout(res, 0));
      }
    }
    // the sound in 1024-sample pieces
    const left = sound.getChannelData(0);
    const right = sound.getChannelData(1);
    for (let at = 0; at < sound.length; at += 1024) {
      const n = Math.min(1024, sound.length - at);
      const data = new Float32Array(n * 2);
      data.set(left.subarray(at, at + n), 0);
      data.set(right.subarray(at, at + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at * 1e6) / sampleRate), data });
      aenc.encode(ad);
      ad.close();
    }
    await Promise.all([venc.flush(), aenc.flush()]);
    if (failed) throw failed;
    muxer.finalize();
    onProgress(r.total, r.total);
    return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), type: "video/mp4" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // the encoders failed part-way on this device: record in real time instead
    return null;
  } finally {
    if (venc.state !== "closed") venc.close();
    if (aenc.state !== "closed") aenc.close();
    await lock?.release().catch(() => undefined);
  }
}

/** The fallback: play the reel once onto the canvas and record it with the sound, in real time. */
async function recordRealtime(input: ReelInput, canvas: HTMLCanvasElement, onProgress: (sec: number, total: number) => void, signal?: AbortSignal, quality: Quality = "high"): Promise<{ blob: Blob; type: string }> {
  const type = recordType();
  if (!type) throw new Error("This browser can't record video. Try Chrome or Safari.");
  const r = await buildReel(input);
  [canvas.width, canvas.height] = r.size;
  const ctx = canvas.getContext("2d")!;
  r.draw(ctx, 0);

  const audio = new AudioContext();
  // browsers only start sound after a tap; without it the clock never moves
  await Promise.race([audio.resume(), new Promise((r) => setTimeout(r, 1500))]);
  if (audio.state !== "running") {
    await audio.close().catch(() => undefined);
    throw new Error("Your browser didn't let the music start. Tap Make my recap again.");
  }
  const dest = audio.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate(r.size, quality), audioBitsPerSecond: quality === "high" ? 192_000 : 128_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));

  let lock: WakeLockSentinel | null = null;
  try {
    lock = (await navigator.wakeLock?.request("screen")) ?? null;
  } catch {
    // no wake lock: the page asks to keep the screen on instead
  }

  const t0 = audio.currentTime + 0.15;
  scheduleSound(audio, dest, input.track, t0, r.total, r.cuts, input.intro, input.frame);
  rec.start(500);
  await new Promise<void>((res, rej) => {
    const tick = () => {
      if (signal?.aborted) return rej(new DOMException("cancelled", "AbortError"));
      const t = Math.max(0, audio.currentTime - t0);
      r.draw(ctx, Math.min(t, r.total));
      onProgress(Math.min(t, r.total), r.total);
      if (t >= r.total + 0.1) return res();
      requestAnimationFrame(tick);
    };
    tick();
  }).finally(async () => {
    rec.stop();
    await done;
    stream.getTracks().forEach((tr) => tr.stop());
    await audio.close().catch(() => undefined);
    await lock?.release().catch(() => undefined);
  });
  return { blob: new Blob(chunks, { type: type.split(";")[0] }), type: type.split(";")[0]! };
}
