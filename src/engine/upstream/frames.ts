/**
 * Reel frames: each wraps the finished reel (see reel.ts) at any output
 * ratio. A frame gives the window the reel fills (the reel is drawn at that
 * shape, so nothing is shrunk to fit) and draws around it. Bands are sized
 * in fixed units (1080-wide grid), not fractions, so on a wide 16:9 video
 * the branding stays small and the reel gets the space. Every frame carries
 * the branding (event, QuestPass, sponsor, credit) outside the window, where
 * a crop of the top or bottom only loses branding, not the photos.
 * Adding a frame is adding an entry here.
 */
import type { JourneyInput } from "@/features/journey/engine/render-journey";
import QRCode from "qrcode";
import type { SponsorBrand } from "@/config/sponsors";
import { C, F, clamp, drawSponsorLogo, text } from "@/features/recap/engine/draw-kit";
import { ROLE_LOOK, firstName, roundRect, wrap, type ReelStats } from "./reel";
import { festivePrints, printsCollage } from "./frames-prints";

const easeOutK = (x: number) => 1 - Math.pow(1 - x, 3);

export type Rect = { x: number; y: number; w: number; h: number };

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export interface FrameCtx {
  W: number;
  H: number;
  /** 1 on a 1080 grid (min side / 1080) */
  u: number;
  /** where the reel is drawn */
  R: Rect;
  t: number;
  total: number;
  /** the current photo's text (or the intro headline) */
  text: string;
  /** the current photo's date (YYYY-MM-DD), if it has one */
  date?: string;
  sponsor: SponsorBrand;
  eventName: string;
  eventDates: string;
  journey: JourneyInput;
  stats?: ReelStats;
  /** this person's reel link (questpass.live/reel/<their QR code>), for the frames' QR codes */
  link?: string;
  /** the postcard's message, written by the person */
  note?: string;
  /**
   * 1 while the reel's own name card or closing card shows (they carry the
   * sponsor and QuestPass themselves), 0 otherwise: the frame's sponsor and
   * credit lines fade out meanwhile, so they don't show twice at once.
   */
  promo?: number;
  /** the colours picked for this frame (one of its palettes, or made from a photo) */
  pal: Palette;
  /**
   * A booth outside the event (/snap, a sponsor's /b/<name>): its own
   * wording instead of the Devcon Mumbai lines. Unset: the event's.
   */
  brand?: FrameBrand;
  /**
   * Words for the frames' text spaces (src/config/frame-words.ts), by id:
   * a space left out shows the frame's own default, "" leaves it off.
   */
  words?: Record<string, string>;
  /** every photo of the reel, for frames that show more than the one playing (photo booth, photo dump) */
  photos?: ImageBitmap[];
  /** while a photo plays: its place in the reel (i of n) and how far through it is (0–1) */
  seg?: { i: number; n: number; p: number };
}

/**
 * A frame's colours. Every frame reads these instead of fixed colours, so
 * each can come in a few ready-made sets (the first is its usual look).
 * bg/fg/muted: the backdrop and text on it; paper/ink: the card or sheet and
 * text on it; accent/accent2: the frame's own highlights.
 */
export interface Palette {
  name: string;
  bg: string;
  fg: string;
  muted: string;
  paper: string;
  ink: string;
  accent: string;
  accent2: string;
  /** the game card only: a rarity's colours instead of the person's own */
  rarity?: keyof typeof RARITY;
}
const P = (name: string, bg: string, fg: string, muted: string, paper: string, ink: string, accent: string, accent2: string): Palette => ({ name, bg, fg, muted, paper, ink, accent, accent2 });

const hexRgb = (c: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgbHex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => Math.round(clamp(x / 255) * 255).toString(16).padStart(2, "0")).join("")}`;
/** `c` (a #RRGGBB colour) at opacity `a`. Other colour strings come back unchanged. */
export function withA(c: string, a: number): string {
  const v = hexRgb(c);
  return v ? `rgba(${v[0]},${v[1]},${v[2]},${a})` : c;
}
/** Mix two #RRGGBB colours (k = 0: a, 1: b). */
export function mix(a: string, b: string, k: number): string {
  const x = hexRgb(a);
  const y = hexRgb(b);
  if (!x || !y) return a;
  return rgbHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
}
/** 0 (black) to 1 (white). */
export function lightness(c: string): number {
  const v = hexRgb(c);
  return v ? (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 : 0.5;
}
/** Black or white, whichever reads on `c`. */
const onColor = (c: string) => (lightness(c) > 0.6 ? "#111111" : "#FFFFFF");

/**
 * A palette from a photo: its strongest colour becomes the accent, the
 * backdrop a deep (or pale, for light frames) shade of it.
 */
export function paletteFromPhoto(base: Palette, img: CanvasImageSource): Palette {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return base;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  // twelve hue buckets, weighted by how colourful each pixel is
  const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!, gg = d[i + 1]!, b = d[i + 2]!;
    const max = Math.max(r, gg, b);
    const min = Math.min(r, gg, b);
    const sat = max ? (max - min) / max : 0;
    if (sat < 0.3 || max < 60 || max > 250) continue;
    let h = 0;
    if (max === r) h = ((gg - b) / (max - min)) % 6;
    else if (max === gg) h = (b - r) / (max - min) + 2;
    else h = (r - gg) / (max - min) + 4;
    const bin = bins[((Math.floor(h * 2) % 12) + 12) % 12]!;
    const w = sat * sat;
    bin.w += w;
    bin.r += r * w;
    bin.g += gg * w;
    bin.b += b * w;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w < 1) return { ...base, name: "From your photo" };
  // the bucket's colour, pushed a little brighter so it reads as an accent
  let accent = rgbHex(best.r / best.w, best.g / best.w, best.b / best.w);
  if (lightness(accent) < 0.35) accent = mix(accent, "#FFFFFF", 0.3);
  return paletteFromAccent(base, accent, "From your photo");
}

/** A palette around one colour: it becomes the accent, the backdrop a deep (or pale, for light frames) shade of it. */
export function paletteFromAccent(base: Palette, accent: string, name = "Your colour"): Palette {
  const dark = lightness(base.bg) < 0.5;
  return { ...base, name, accent, bg: mix(accent, dark ? "#000000" : "#FFFFFF", dark ? 0.82 : 0.8) };
}

export type FrameGroup = "Fun" | "Clean" | "Retro" | "Travel" | "For devs" | "Festive";

export interface FrameDef {
  label: string;
  group: FrameGroup;
  /** its colour sets, the usual one first (a function: some follow the site's theme, read when drawn) */
  palettes(): Palette[];
  /** the window the reel fills */
  window(W: number, H: number, u: number): Rect;
  /** drawn before the reel */
  back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
  /** drawn over it */
  front?(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
  /** the frame shows each photo's text itself (so the reel leaves it off the photo) */
  ownsText?: boolean;
  /** the frame prints the photo's date itself (so the reel leaves its date stamp off) */
  ownsDate?: boolean;
  /** radians the reel is turned by */
  tilt?: number;
  /** picture corners the watermark may use (the rest hold the frame's own marks); default all */
  marks?: Corner[];
}

export type Corner = "tl" | "tr" | "bl" | "br";

const CREDIT = "made by @simarpreet_019";

/** A booth's own wording for the frames (see FrameCtx.brand). Empty strings leave a line off. */
export interface FrameBrand {
  /** where it is ("Mumbai" on the event's frames) */
  place: string;
  /** the site's name in the corners ("QuestPass") */
  mark: string;
  /** the site's address ("questpass.live") */
  site: string;
  /** the small credit line */
  credit: string;
  /** show "powered by" and the sponsor's logo */
  sponsor: boolean;
  /** a logo for the newspaper's advertisement box (loaded before drawing) */
  adLogo?: string;
}
/** A text space's words: undefined → the frame's default, "" → off. */
const wordOf = (f: FrameCtx, id: string): string | undefined => f.words?.[id];
const placeOf = (f: FrameCtx) => (f.brand ? f.brand.place : "Mumbai");
const markOf = (f: FrameCtx) => (f.brand ? f.brand.mark : "QuestPass");
const creditOf = (f: FrameCtx) => (f.brand ? f.brand.credit : CREDIT);
/** "QUESTPASS · made by …", leaving off what the booth has none of */
const signOf = (f: FrameCtx) => [markOf(f).toUpperCase(), creditOf(f)].filter(Boolean).join(" · ");
/** 3 letters for a ticket: "Riya's Party" → "RIY" */
const code3 = (s: string) => s.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "---";
/** The route on the tickets: the pass's (city → Mumbai), or a booth's own (its From, else Home → its To, else its title). */
function routeFor(f: FrameCtx, fromId = "pass.from") {
  if (!f.brand) return { fromCode: f.journey.code, from: f.journey.city.toUpperCase(), toCode: "BOM", to: "MUMBAI" };
  const from = (wordOf(f, fromId) ?? "Home") || "Home";
  const to = (wordOf(f, "pass.to") ?? f.eventName) || "The party";
  return { fromCode: code3(from), from: from.toUpperCase(), toCode: code3(to), to: to.toUpperCase() };
}
/** The ticket number: the pass's, or one made from the booth and the person ("RIY-ASHA-0001"). */
const ticketOf = (f: FrameCtx) => (f.brand ? `${code3(f.eventName || "SNAP")}-${(firstName(f.journey.name) || "GUEST").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}-0001` : f.journey.ticket);

/** "Devcon 8 · Mumbai", or just the title where there's no place */
const titleAt = (f: FrameCtx) => [f.eventName, placeOf(f)].filter(Boolean).join(" · ");

/** A window between a top and a bottom band and side margins, all in grid units. */
const banded = (top: number, bottom: number, side: number) => (W: number, H: number, u: number): Rect => {
  // wide (16:9): thin side margins, so the reel fills more of the width
  const sx = (W > 1.3 * H ? side * 0.35 : side) * u;
  return { x: sx, y: top * u, w: W - sx * 2, h: H - (top + bottom) * u };
};

/** Same, but never wider than `maxAspect` (centred), for frames that look odd stretched wide. */
const capped = (top: number, bottom: number, side: number, maxAspect: number) => (W: number, H: number, u: number): Rect => {
  const r = banded(top, bottom, side)(W, H, u);
  const w = Math.min(r.w, r.h * (W > 1.3 * H ? Math.max(maxAspect * 1.25, 1.8) : maxAspect));
  return { ...r, x: (W - w) / 2, w };
};

const lum = (d: Uint8ClampedArray) => {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3]! < 128) continue;
    sum += (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
    n++;
  }
  return n ? sum / n : null;
};
const logoLum = new Map<string, number | null>();

/**
 * How light an area of `ctx`'s canvas is, read through a tiny copy: reading
 * the recorded canvas itself every frame makes Chrome move it off the GPU
 * mid-recording, which changes the video's encoding part-way through (apps
 * like X and Instagram then play only the part before the change).
 */
let snap: CanvasRenderingContext2D | null = null;
function areaLum(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): number | null {
  if (!snap) {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 8;
    snap = c.getContext("2d", { willReadFrequently: true });
  }
  if (!snap) return null;
  snap.clearRect(0, 0, 32, 8);
  snap.drawImage(ctx.canvas, x, y, Math.max(1, w), Math.max(1, h), 0, 0, 32, 8);
  return lum(snap.getImageData(0, 0, 32, 8).data);
}

/**
 * The sponsor's logo, with a light or dark plate behind it when the logo's
 * colour is too close to what is under it (a black logo on a dark frame, a
 * white one on newsprint), so it always reads. Returns the width drawn.
 */
export function sponsorLogo(ctx: CanvasRenderingContext2D, sponsor: SponsorBrand, x: number, y: number, h: number): number {
  const probe = document.createElement("canvas");
  const w = Math.ceil(drawSponsorLogo(probe.getContext("2d")!, sponsor, 0, 0, h));
  if (w <= 0) return 0;
  let lg = logoLum.get(sponsor.id);
  if (lg === undefined) {
    probe.width = w;
    probe.height = Math.ceil(h);
    const pc = probe.getContext("2d", { willReadFrequently: true })!;
    drawSponsorLogo(pc, sponsor, 0, 0, h);
    try {
      lg = lum(pc.getImageData(0, 0, probe.width, probe.height).data);
    } catch {
      lg = null;
    }
    // only cache once the logo image has loaded (an unloaded image draws nothing)
    if (lg !== null) logoLum.set(sponsor.id, lg);
  }
  if (lg != null) {
    let bg: number | null = null;
    try {
      const t = ctx.getTransform();
      bg = areaLum(ctx, Math.round(t.a * x + t.e), Math.round(t.d * y + t.f), Math.round(w * t.a), Math.round(h * t.d));
    } catch {
      bg = null;
    }
    if (bg !== null && Math.abs(lg - bg) < 0.3) {
      const pad = h * 0.25;
      ctx.save();
      ctx.fillStyle = lg < 0.5 ? "rgba(245,243,236,0.92)" : "rgba(14,14,18,0.88)";
      roundRect(ctx, { x: x - pad, y: y - pad * 0.6, w: w + pad * 2, h: h + pad * 1.2 }, (h + pad * 1.2) / 2);
      ctx.fill();
      ctx.restore();
    }
  }
  drawSponsorLogo(ctx, sponsor, x, y, h);
  return w;
}

/** Draw the frame's own sponsor / credit line, faded while the reel's cards carry them. */
function dim(ctx: CanvasRenderingContext2D, f: FrameCtx, draw: () => void) {
  const a = 1 - (f.promo ?? 0);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  draw();
  ctx.restore();
}

function poweredBy(ctx: CanvasRenderingContext2D, f: FrameCtx, x: number, y: number, px: number, color: string, align: "left" | "center" | "right") {
  dim(ctx, f, () => poweredByNow(ctx, f, x, y, px, color, align));
}
function poweredByNow(ctx: CanvasRenderingContext2D, f: FrameCtx, x: number, y: number, px: number, color: string, align: "left" | "center" | "right") {
  if (f.brand && !f.brand.sponsor) return;
  const words = `${f.sponsor.copy.poweredBy} `;
  ctx.font = F.sans(px, 500);
  const ww = ctx.measureText(words).width;
  const lh = px * 1.5;
  const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d")!, f.sponsor, 0, 0, lh);
  const x0 = align === "center" ? x - (ww + lw) / 2 : align === "right" ? x - ww - lw : x;
  text(ctx, words, x0, y, F.sans(px, 500), color, "left");
  sponsorLogo(ctx, f.sponsor, x0 + ww, y - lh / 2, lh);
}

/** Top: event and QuestPass. Bottom: sponsor and credit. Centred in the bands around the window. */
function bands(ctx: CanvasRenderingContext2D, f: FrameCtx, ink: string, accent: string, muted: string, top = f.R.y, bottom = f.R.y + f.R.h) {
  const { u } = f;
  const mx = Math.max(f.R.x, 40 * u);
  text(ctx, f.eventName.toUpperCase(), mx, top / 2, F.mono(24 * u, 700), accent, "left");
  dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), f.W - mx, top / 2, F.mono(24 * u, 700), ink, "right"));
  const by = bottom + (f.H - bottom) / 2;
  poweredBy(ctx, f, mx, by, 22 * u, muted, "left");
  dim(ctx, f, () => text(ctx, creditOf(f), f.W - mx, by, F.mono(20 * u, 500), muted, "right"));
}

/* ------------------------------------------------- boarding pass (ticket) */

/**
 * A ticket's outline: rounded corners and two half-circle bites at the tear
 * line (`notch.y` across a tall ticket, `notch.x` down a wide one).
 */
function ticketPath(ctx: CanvasRenderingContext2D, c: Rect, rad: number, notch: { x?: number; y?: number }, nr: number) {
  const r = c.x + c.w;
  const b = c.y + c.h;
  ctx.beginPath();
  ctx.moveTo(c.x + rad, c.y);
  if (notch.x != null) {
    ctx.lineTo(notch.x - nr, c.y);
    ctx.arc(notch.x, c.y, nr, Math.PI, 0, true);
  }
  ctx.lineTo(r - rad, c.y);
  ctx.arcTo(r, c.y, r, c.y + rad, rad);
  if (notch.y != null) {
    ctx.lineTo(r, notch.y - nr);
    ctx.arc(r, notch.y, nr, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.lineTo(r, b - rad);
  ctx.arcTo(r, b, r - rad, b, rad);
  if (notch.x != null) {
    ctx.lineTo(notch.x + nr, b);
    ctx.arc(notch.x, b, nr, 0, Math.PI, true);
  }
  ctx.lineTo(c.x + rad, b);
  ctx.arcTo(c.x, b, c.x, b - rad, rad);
  if (notch.y != null) {
    ctx.lineTo(c.x, notch.y + nr);
    ctx.arc(c.x, notch.y, nr, Math.PI / 2, -Math.PI / 2, true);
  }
  ctx.lineTo(c.x, c.y + rad);
  ctx.arcTo(c.x, c.y, c.x + rad, c.y, rad);
  ctx.closePath();
}

/** Where everything sits on the boarding pass: tall (stub below the photo) or wide (stub on the right). */
function passLayout(W: number, H: number, u: number) {
  const wide = W >= H * 0.95;
  if (wide) {
    const card = { x: 50 * u, y: 70 * u, w: W - 100 * u, h: H - 130 * u };
    const stubW = Math.min(440 * u, card.w * 0.34);
    const tear = card.x + card.w - stubW;
    const R = { x: card.x + 30 * u, y: card.y + 200 * u, w: tear - card.x - 60 * u, h: card.h - 230 * u };
    return { wide, card, tear, R, head: { x: card.x, y: card.y, w: tear - card.x, h: 200 * u }, stub: { x: tear, y: card.y, w: stubW, h: card.h } };
  }
  const card = { x: 50 * u, y: 60 * u, w: W - 100 * u, h: H - 100 * u };
  const stubH = 300 * u;
  const tear = card.y + card.h - stubH;
  const R = { x: card.x + 30 * u, y: card.y + 270 * u, w: card.w - 60 * u, h: tear - card.y - 310 * u };
  return { wide, card, tear, R, head: { x: card.x, y: card.y, w: card.w, h: 270 * u }, stub: { x: card.x, y: tear, w: card.w, h: stubH } };
}

/** A barcode from the ticket number (the same ticket always gets the same bars). */
function barcode(ctx: CanvasRenderingContext2D, seed: string, x: number, y: number, w: number, h: number, ink: string) {
  let v = 0;
  for (const ch of seed) v = (v * 31 + ch.charCodeAt(0)) >>> 0;
  ctx.fillStyle = ink;
  let cx = x;
  while (cx < x + w) {
    v = (v * 1103515245 + 12345) >>> 0;
    const bw = 1 + (v % 4);
    const unit = w / 180;
    if ((v >> 8) % 3 !== 0) ctx.fillRect(cx, y, bw * unit, h);
    cx += (bw + 1 + ((v >> 4) % 2)) * unit;
  }
}

/* ------------------------------------------------------ game card (FUT-ish) */

const RARITY = {
  legendary: { name: "LEGENDARY", stars: "★★★★★", base: ["#2B1650", "#0F0A22"], foil: ["#FF7AD9", "#FFE27A", "#7AF0FF", "#B07CFF"], accent: "#FFE27A" },
  epic: { name: "EPIC", stars: "★★★★", base: ["#2A1240", "#0E0A1C"], foil: ["#C77DFF", "#FF8AD8", "#9AE6FF", "#E9B8FF"], accent: "#E9B8FF" },
  rare: { name: "RARE", stars: "★★★", base: ["#2E2208", "#120D04"], foil: ["#FFE08A", "#B8862B", "#FFF6D6", "#F2C94C"], accent: "#F2C94C" },
  uncommon: { name: "UNCOMMON", stars: "★★", base: ["#1E2530", "#0C1016"], foil: ["#E6EEF7", "#8DA2B8", "#FFFFFF", "#AFC3D6"], accent: "#DDE7F2" },
} as const;
const rarityOf = (j: JourneyInput) => RARITY[j.early ? "legendary" : j.traveller <= 100 ? "epic" : j.traveller <= 500 ? "rare" : "uncommon"];
/** The card's colours: the person's own rarity, or the one picked as its colour set (the words stay the person's). */
const rarFor = (f: FrameCtx) => {
  const own = rarityOf(f.journey);
  return f.pal.rarity ? { ...RARITY[f.pal.rarity], name: own.name, stars: own.stars } : own;
};
/** Tall: the panel under the photo. Wide: beside it. */
function gameLayout(W: number, H: number, u: number) {
  const wide = W >= H * 0.95;
  const card = wide ? { x: 60 * u, y: 70 * u, w: W - 120 * u, h: H - 140 * u } : { x: 60 * u, y: 90 * u, w: W - 120 * u, h: H - 150 * u };
  const m = 34 * u;
  if (wide) {
    const pw = Math.min(480 * u, card.w * 0.36);
    const R = { x: card.x + m, y: card.y + m, w: card.w - m * 2 - pw - 16 * u, h: card.h - m * 2 };
    return { wide, card, R, panel: { x: R.x + R.w + 16 * u, y: R.y, w: pw, h: R.h } };
  }
  const ph = 330 * u;
  const R = { x: card.x + m, y: card.y + m, w: card.w - m * 2, h: card.h - m * 2 - ph };
  return { wide, card, R, panel: { x: R.x, y: R.y + R.h + 16 * u, w: R.w, h: card.y + card.h - m - (R.y + R.h + 16 * u) } };
}

/** A card with clipped corners (like a trading card's foil cut). */
function chamfer(ctx: CanvasRenderingContext2D, c: Rect, k: number) {
  ctx.beginPath();
  ctx.moveTo(c.x + k, c.y);
  ctx.lineTo(c.x + c.w - k, c.y);
  ctx.lineTo(c.x + c.w, c.y + k);
  ctx.lineTo(c.x + c.w, c.y + c.h - k);
  ctx.lineTo(c.x + c.w - k, c.y + c.h);
  ctx.lineTo(c.x + k, c.y + c.h);
  ctx.lineTo(c.x, c.y + c.h - k);
  ctx.lineTo(c.x, c.y + k);
  ctx.closePath();
}

/** A four-point sparkle. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

/**
 * The game card's opening, like a game's legendary chest: (after the first
 * frame, which stays the name card for the thumbnail) a chest in the rarity's
 * colours glows and shakes harder, bursts open in a flash with sparks, and the
 * card is revealed with "LEGENDARY!" (or the person's rarity) popping in.
 */
const PACK_FROM = 0.12;
const PACK_BURST = 1.2;
function chestOpening(ctx: CanvasRenderingContext2D, f: FrameCtx) {
  const { W, H, u, t } = f;
  if (t < PACK_FROM || t > 2.9) return;
  const rar = rarFor(f);
  const cx = W / 2;
  const cy = H / 2;
  const m = Math.min(W, H);
  const before = t < PACK_BURST;
  // the dark screen with the chest, until the burst
  const cover = before ? 1 : 1 - clamp((t - PACK_BURST - 0.08) / 0.25);
  if (cover > 0) {
    ctx.save();
    ctx.globalAlpha = cover;
    ctx.fillStyle = "#07060D";
    ctx.fillRect(0, 0, W, H);
    // light rays turning behind the chest
    const build = clamp((t - PACK_FROM) / (PACK_BURST - PACK_FROM));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.8);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = i % 2 ? `${rar.foil[1]}22` : `${rar.foil[0]}33`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-m * 0.08, -m);
      ctx.lineTo(m * 0.08, -m);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * (0.35 + 0.15 * build));
    glow.addColorStop(0, `${rar.accent}AA`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // the chest: shakes harder as it builds, the lid flies off at the burst
    const cw = m * 0.42;
    const ch = cw * 0.78;
    const shake = before ? Math.sin(t * 70) * build * build * 12 * u : 0;
    const bob = Math.sin(t * 5) * 6 * u;
    const x = cx - cw / 2 + shake;
    const bodyY = cy - ch * 0.1 + bob;
    const bodyH = ch * 0.6;
    const lidH = ch * 0.4;
    const gold = "#F2C94C";
    const purple = ctx.createLinearGradient(x, bodyY - lidH, x, bodyY + bodyH);
    purple.addColorStop(0, rar.foil[0]);
    purple.addColorStop(1, rar.base[0]);
    // body
    ctx.fillStyle = purple;
    ctx.beginPath();
    ctx.roundRect(x, bodyY, cw, bodyH, 10 * u);
    ctx.fill();
    ctx.lineWidth = 7 * u;
    ctx.strokeStyle = gold;
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(x + cw * 0.22, bodyY, cw * 0.07, bodyH);
    ctx.fillRect(x + cw * 0.71, bodyY, cw * 0.07, bodyH);
    // lid (rises and tips back after the burst)
    const fly = before ? 0 : easeOutK(clamp((t - PACK_BURST) / 0.5));
    ctx.save();
    ctx.translate(x + cw / 2, bodyY - fly * m * 0.5);
    ctx.rotate(-fly * 0.9);
    ctx.fillStyle = purple;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, 0);
    ctx.lineTo(-cw / 2, -lidH * 0.45);
    ctx.quadraticCurveTo(-cw / 2, -lidH, 0, -lidH);
    ctx.quadraticCurveTo(cw / 2, -lidH, cw / 2, -lidH * 0.45);
    ctx.lineTo(cw / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 7 * u;
    ctx.strokeStyle = gold;
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(-cw * 0.28, -lidH * 0.95, cw * 0.07, lidH * 0.95);
    ctx.fillRect(cw * 0.21, -lidH * 0.95, cw * 0.07, lidH * 0.95);
    ctx.restore();
    // the lock
    if (before) {
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.arc(x + cw / 2, bodyY + 4 * u, cw * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rar.base[1];
      ctx.fillRect(x + cw / 2 - 3 * u, bodyY - 4 * u, 6 * u, 16 * u);
    }
    text(ctx, before ? "OPENING YOUR PACK…" : "", cx, cy + ch * 0.75, F.mono(26 * u, 800), "rgba(255,255,255,0.75)");
    text(ctx, f.eventName.toUpperCase(), cx, cy - ch * 0.95, F.mono(24 * u, 800), rar.accent);
    ctx.restore();
  }
  // the burst: a white flash and sparks flying out over the revealed card
  const since = t - PACK_BURST;
  if (since >= 0) {
    const flash = 1 - clamp(since / 0.3);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (since < 1.2) {
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * Math.PI * 2 + i * 0.37;
        const sp = m * (0.5 + ((i * 0.618) % 1) * 0.6);
        const px = cx + Math.cos(ang) * sp * since;
        const py = cy + Math.sin(ang) * sp * since + 0.5 * m * 0.9 * since * since;
        sparkle(ctx, px, py, (10 + (i % 4) * 5) * u, 1 - since / 1.2);
      }
    }
    // the rarity pops in, then fades
    const pop = clamp((since - 0.1) / 0.35);
    const out = 1 - clamp((t - 2.4) / 0.4);
    if (pop > 0 && out > 0) {
      const sc = pop < 1 ? 0.6 + 0.55 * Math.sin(pop * Math.PI * 0.75) : 1;
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(cx, H * 0.16);
      ctx.scale(sc, sc);
      ctx.shadowColor = rar.foil[0];
      ctx.shadowBlur = 30 * u;
      text(ctx, `${rar.name}!`, 0, 0, F.display(96 * u, 900), rar.accent);
      ctx.shadowBlur = 0;
      text(ctx, rar.stars, 0, 70 * u, F.sans(44 * u, 800), "#FFFFFF");
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------ lanyard badge */

/** Where things sit on the lanyard badge: tall (photo above the name) or wide (name and QR beside it). */
function badgeLayout(W: number, H: number, u: number) {
  const wide = W >= H * 0.95;
  if (wide) {
    const side = Math.min(220 * u, W * 0.1);
    const badge = { x: side, y: 150 * u, w: W - side * 2, h: H - 210 * u };
    const R = { x: badge.x + 40 * u, y: badge.y + 110 * u, w: badge.w * 0.62, h: badge.h - 150 * u };
    return { wide, badge, R, info: { x: R.x + R.w + 36 * u, y: R.y, w: badge.x + badge.w - 40 * u - (R.x + R.w + 36 * u), h: R.h } };
  }
  const badge = { x: 100 * u, y: 250 * u, w: W - 200 * u, h: H - 330 * u };
  const R = { x: badge.x + 40 * u, y: badge.y + 140 * u, w: badge.w - 80 * u, h: badge.h - 520 * u };
  return { wide, badge, R, info: { x: R.x, y: R.y + R.h + 30 * u, w: R.w, h: badge.y + badge.h - 40 * u - (R.y + R.h + 30 * u) } };
}

/**
 * A QR code drawn on the canvas (no image to load). `round`: dots and
 * rounded corner eyes in `accent`, with the person's photo (or initial) in
 * the middle, like the My QR card (the code carries enough redundancy to
 * scan with the middle covered).
 */
const qrCache = new Map<string, ReturnType<typeof QRCode.create>>();
export function drawQr(
  ctx: CanvasRenderingContext2D,
  data: string,
  x: number,
  y: number,
  size: number,
  ink: string,
  opts: { round?: boolean; accent?: string; avatar?: CanvasImageSource & { width: number; height: number }; letter?: string } = {},
) {
  const level = opts.round ? "H" : "M";
  let q = qrCache.get(level + data);
  if (!q) {
    q = QRCode.create(data, { errorCorrectionLevel: level });
    qrCache.set(level + data, q);
  }
  const n = q.modules.size;
  const cell = size / n;
  if (!opts.round) {
    ctx.fillStyle = ink;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
    return;
  }
  const eye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const hole = Math.floor(n * 0.22);
  const mid0 = Math.floor((n - hole) / 2);
  const inHole = (r: number, c: number) => r >= mid0 && r < mid0 + hole && c >= mid0 && c < mid0 + hole;
  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!q.modules.get(r, c) || eye(r, c) || inHole(r, c)) continue;
      ctx.beginPath();
      ctx.arc(x + (c + 0.5) * cell, y + (r + 0.5) * cell, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  // the three eyes: a rounded ring and a rounded centre in the accent colour
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
    const ex = x + c0 * cell;
    const ey = y + r0 * cell;
    ctx.fillStyle = opts.accent ?? ink;
    ctx.beginPath();
    ctx.roundRect(ex, ey, cell * 7, cell * 7, cell * 2);
    ctx.roundRect(ex + cell, ey + cell, cell * 5, cell * 5, cell * 1.4);
    ctx.fill("evenodd");
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(ex + cell * 2, ey + cell * 2, cell * 3, cell * 3, cell);
    ctx.fill();
  }
  // the face in the middle
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rad = (hole * cell) / 2 - cell * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = opts.accent ?? ink;
  ctx.fill();
  ctx.clip();
  if (opts.avatar) {
    const a = opts.avatar;
    const s = Math.max((rad * 2) / a.width, (rad * 2) / a.height);
    ctx.drawImage(a, cx - (a.width * s) / 2, cy - (a.height * s) / 2, a.width * s, a.height * s);
  } else if (opts.letter) text(ctx, opts.letter, cx, cy, F.sans(rad * 1.1, 900), "#FFFFFF");
  ctx.restore();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = cell * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
}

const fill = (ctx: CanvasRenderingContext2D, f: FrameCtx, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, f.W, f.H);
};

/** A picture covering `r` (cropped to fit). */
function coverImg(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, r: Rect) {
  const s = Math.max(r.w / img.width, r.h / img.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.drawImage(img, r.x + (r.w - img.width * s) / 2, r.y + (r.h - img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}

/** A gradient from `c` (top left) to a deeper shade of it (bottom right). */
function deep(ctx: CanvasRenderingContext2D, f: FrameCtx, c: string, k = 0.45) {
  const g = ctx.createLinearGradient(0, 0, f.W, f.H);
  g.addColorStop(0, c);
  g.addColorStop(1, mix(c, "#000000", k));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.W, f.H);
}

/** The day to print: the photo's date, else a day of the event week as the reel plays. */
function dayOf(f: FrameCtx): Date {
  const [y, mo, d] = (f.date ?? "").split("-").map(Number);
  if (y && mo && d) return new Date(y, mo - 1, d);
  // a booth outside the event: today, not a day of the Devcon week
  if (f.brand) return new Date();
  return new Date(2026, 10, 3 + Math.min(3, Math.floor((f.t / Math.max(1, f.total)) * 4)));
}
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

/** Tall or wide (16:9, and near-square counts as wide for side-by-side layouts). */
const isWide = (W: number, H: number) => W > 1.3 * H;

/** A rubber stamp: a double-ruled box with words, turned a little. */
function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, color: string, lines: string[], u: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= 0.88;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * u;
  roundRect(ctx, { x: -w / 2, y: -h / 2, w, h }, 14 * u);
  ctx.stroke();
  ctx.lineWidth = 2 * u;
  roundRect(ctx, { x: -w / 2 + 9 * u, y: -h / 2 + 9 * u, w: w - 18 * u, h: h - 18 * u }, 9 * u);
  ctx.stroke();
  const lh = (h - 30 * u) / lines.length;
  lines.forEach((l, i) => {
    ctx.font = F.mono(lh * (i === 0 ? 0.62 : 0.5), 800);
    const px = Math.min(lh * (i === 0 ? 0.62 : 0.5), ((lh * (i === 0 ? 0.62 : 0.5)) * (w - 36 * u)) / Math.max(1, ctx.measureText(l).width));
    text(ctx, l, 0, -h / 2 + 15 * u + lh * (i + 0.5), F.mono(px, 800), color);
  });
  ctx.restore();
}

/** A starburst (comic "POW!"). */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spikes: number, fillC: string, stroke: string, lw: number) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.62 : r * (0.92 + 0.08 * Math.sin(i * 2.3));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillC;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** Text with a neon glow. */
function glow(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, u: number, on = 1, align: "left" | "center" | "right" = "center") {
  ctx.save();
  ctx.globalAlpha *= 0.35 + 0.65 * on;
  ctx.shadowColor = color;
  ctx.shadowBlur = 34 * u * on;
  text(ctx, s, x, y, font, color, align);
  ctx.shadowBlur = 14 * u * on;
  text(ctx, s, x, y, font, mix(color, "#FFFFFF", 0.55), align);
  ctx.restore();
}

/** One line of code: coloured pieces, one after the other. */
function codeLine(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, parts: [string, string][], maxW: number) {
  ctx.font = F.mono(px, 500);
  let cx = x;
  for (const [s, c] of parts) {
    const w = ctx.measureText(s).width;
    if (cx + w > x + maxW) {
      let cut = s;
      while (cut.length > 1 && cx + ctx.measureText(`${cut}…`).width > x + maxW) cut = cut.slice(0, -1);
      text(ctx, `${cut}…`, cx, y, F.mono(px, 500), c, "left");
      return;
    }
    text(ctx, s, cx, y, F.mono(px, 500), c, "left");
    cx += w;
  }
}

/** The photo booth's strip: four cells down a tall reel, across a wide one; the reel plays in the first. */
function boothLayout(W: number, H: number, u: number) {
  const pad = 24 * u;
  if (isWide(W, H)) {
    const cellW = (W - 200 * u - 5 * pad) / 4;
    const cellH = Math.min(H - 330 * u, cellW * 1.3);
    const strip = { x: 100 * u, y: (H - cellH - 2 * pad - 70 * u) / 2, w: W - 200 * u, h: cellH + 2 * pad + 70 * u };
    const cells = [0, 1, 2, 3].map((i) => ({ x: strip.x + pad + i * (cellW + pad), y: strip.y + pad, w: cellW, h: cellH }));
    return { strip, cells, foot: { x: strip.x, y: strip.y + pad + cellH, w: strip.w, h: 70 * u + pad } };
  }
  const cellH = (H - 360 * u - 5 * pad) / 4;
  const cellW = Math.min(W - 220 * u, cellH * 1.35);
  const strip = { x: (W - cellW - 2 * pad) / 2, y: 120 * u, w: cellW + 2 * pad, h: 4 * cellH + 5 * pad + 90 * u };
  const cells = [0, 1, 2, 3].map((i) => ({ x: strip.x + pad, y: strip.y + pad + i * (cellH + pad), w: cellW, h: cellH }));
  return { strip, cells, foot: { x: strip.x, y: strip.y + 4 * (cellH + pad), w: strip.w, h: 90 * u + pad } };
}

/** The photo dump: the reel big, the other photos as a grid of small ones (below it, or beside a wide reel). */
function dumpLayout(W: number, H: number, u: number) {
  if (isWide(W, H)) {
    const R = { x: 60 * u, y: 130 * u, w: W * 0.58, h: H - 220 * u };
    const g = { x: R.x + R.w + 30 * u, y: R.y, w: W - 60 * u - (R.x + R.w + 30 * u), h: R.h };
    return { R, grid: g, cols: 2, rows: 3 };
  }
  const R = { x: 50 * u, y: 170 * u, w: W - 100 * u, h: H - 170 * u - 560 * u };
  return { R, grid: { x: R.x, y: R.y + R.h + 24 * u, w: R.w, h: 470 * u }, cols: 4, rows: 2 };
}

/** The music player: square-ish art with the song's line, a progress bar and the controls under it (beside it when wide). */
function playerLayout(W: number, H: number, u: number) {
  if (isWide(W, H)) {
    const h = H - 220 * u;
    const R = { x: 110 * u, y: 120 * u, w: Math.min(h * 1.1, W * 0.5), h };
    return { R, info: { x: R.x + R.w + 70 * u, y: R.y + R.h * 0.18, w: W - 110 * u - (R.x + R.w + 70 * u) } };
  }
  const R = capped(200, 640, 70, 1.0)(W, H, u);
  return { R, info: { x: R.x, y: R.y + R.h + 60 * u, w: R.w } };
}

/** The calendar page: a sheet with rings, the month, the big day, the photo under them. */
function calLayout(W: number, H: number, u: number) {
  const wide = isWide(W, H);
  const sheet = { x: 60 * u, y: 70 * u, w: W - 120 * u, h: H - 110 * u };
  const head = wide ? 230 * u : 360 * u;
  return { wide, sheet, R: { x: sheet.x + (wide ? 40 : 40) * u, y: sheet.y + head, w: sheet.w - 80 * u, h: sheet.h - head - (wide ? 90 : 140) * u } };
}

/** The code editor: title bar, gutter of line numbers, code above and below the picture, a status bar. */
const CODE = { bar: 70, line: 44, top: 3, bottom: 4, status: 50, gutter: 100 };
function codeWindow(W: number, H: number, u: number): Rect {
  const top = (CODE.bar + CODE.line * CODE.top + 26) * u;
  const bottom = (CODE.status + CODE.line * CODE.bottom + 26) * u;
  return { x: CODE.gutter * u, y: top, w: W - (CODE.gutter + 40) * u, h: H - top - bottom };
}

const COMIC_WORDS = ["POW!", "WOW!", "ZAP!", "BAM!", "BOOM!", "WHOA!", "YES!"];
const PASSPORT_STAMPS = ["ADMITTED", "SIDE QUEST", "ARRIVED", "CHECKED IN", "VISA", "LEVEL UP"];
const OPEN_STAMPS = ["ADMITTED", "VIP", "GOOD TIMES", "CHECKED IN", "ARRIVED", "LEVEL UP"];
/** The passport's stamps: the event's, or a booth's own words (comma between). */
function stampsOf(f: FrameCtx): string[] {
  if (!f.brand) return PASSPORT_STAMPS;
  const own = wordOf(f, "passport.stamps")?.split(",").map((x) => x.trim().toUpperCase().slice(0, 14)).filter(Boolean);
  return own?.length ? own : OPEN_STAMPS;
}

const DEFS = {
  clean: {
    label: "✨ Clean",
    group: "Clean",
    palettes: () => [
      P("Night", C.bg, C.white, C.grey, C.bg, C.white, C.neon, C.gold),
      P("Paper", "#F4F1EA", "#141413", "#6B6A66", "#FFFFFF", "#141413", "#2F5FBF", "#C8102E"),
      P("Marigold", "#1A1208", "#FFF6E5", "#B9A27A", "#2A1E10", "#FFF6E5", "#FFB020", "#FF6B3D"),
      P("Ocean", "#06202B", "#E6F6FF", "#7FA6B8", "#0B2E3C", "#E6F6FF", "#3DD6D0", "#FFD166"),
      P("Rose", "#2A0E1C", "#FFE9F2", "#C08AA3", "#3A1426", "#FFE9F2", "#FF7AB6", "#FFD166"),
    ],
    window: banded(90, 90, 24),
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted);
    },
  },

  newspaper: {
    label: "📰 Newspaper",
    group: "Retro",
    palettes: () => [
      P("Classic", "#F2ECDD", "#1B1916", "#5A564E", "#F2ECDD", "#1B1916", "#1B1916", "#1B1916"),
      P("Pink paper", "#F4D8CB", "#1B1916", "#5A4A44", "#F4D8CB", "#1B1916", "#8A1C1C", "#1B1916"),
      P("Night edition", "#141414", "#EDE8DC", "#9A958A", "#141414", "#EDE8DC", "#F2C94C", "#EDE8DC"),
      P("Blueprint", "#E3ECF7", "#12305C", "#4A6080", "#E3ECF7", "#12305C", "#12305C", "#12305C"),
      P("Mint", "#E2F0E6", "#173A2A", "#4E6B5D", "#E2F0E6", "#173A2A", "#1F6B45", "#173A2A"),
    ],
    // tall: room for a line of numbers between the headline and the photo
    window: (W, H, u) => capped(W > 1.3 * H ? 250 : 300, 130, 50, 1.5)(W, H, u),
    ownsText: true,
    back(ctx, f) {
      const ink = f.pal.ink;
      const { u, W, R } = f;
      const mx = 50 * u;
      fill(ctx, f, f.pal.paper);
      let y = 36 * u;
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), mx, y, F.mono(22 * u, 700), ink, "left"));
      dim(ctx, f, () => text(ctx, f.brand ? f.brand.site : "questpass.live", W - mx, y, F.mono(22 * u, 500), ink, "right"));
      y += 52 * u;
      {
        // the masthead: the booth's title, shrunk to fit
        const mast = f.brand ? f.eventName : "The Mumbai Daily";
        ctx.font = F.display(76 * u, 900);
        const mpx = Math.min(76 * u, (76 * u * (W - mx * 2)) / Math.max(1, ctx.measureText(mast).width));
        text(ctx, mast, W / 2, y, F.display(mpx, 900), f.pal.accent);
      }
      y += 48 * u;
      ctx.fillStyle = ink;
      ctx.fillRect(mx, y, W - mx * 2, 4 * u);
      y += 22 * u;
      text(ctx, [`${f.brand ? "SPECIAL" : f.eventName.toUpperCase()} EDITION`, f.eventDates.toUpperCase()].filter(Boolean).join("  ·  "), W / 2, y, F.mono(20 * u, 600), ink);
      y += 18 * u;
      ctx.fillRect(mx, y, W - mx * 2, 1.5 * u);
      ctx.font = F.display(46 * u, 900);
      const hl = wrap(ctx, wordOf(f, "newspaper.headline") ?? f.text, W - mx * 2, 1)[0] ?? "";
      text(ctx, hl, W / 2, R.x > mx * 3 ? (y + R.y) / 2 : (y + R.y - 50 * u) / 2, F.display(46 * u, 900), ink);
      // the numbers: the site's on one side, this person's on the other
      const st = f.stats;
      const left: [string, string][] = st ? [[st.pins.toLocaleString(), "passes pinned"], [String(st.countries), st.countries === 1 ? "country" : "countries"], [String(st.states), "Indian states"]] : [];
      const right: [string, string][] = st ? [[`${f.journey.km.toLocaleString()} km`, `from ${f.journey.city}`], ...(st.attended ? [[String(st.attended), st.attended === 1 ? "side event" : "side events"] as [string, string]] : [])] : [];
      const story = wordOf(f, "newspaper.story");
      const column = (x0: number, w: number, head: string, rows: [string, string][], body?: string) => {
        let yy = R.y + 10 * u;
        text(ctx, head, x0 + w / 2, yy, F.mono(16 * u, 700), ink);
        yy += 16 * u;
        ctx.fillRect(x0, yy, w, 2 * u);
        for (const [n, l] of rows) {
          yy += 52 * u;
          text(ctx, n, x0 + w / 2, yy, F.display(Math.min(44 * u, w / 5), 900), ink);
          yy += 34 * u;
          text(ctx, l.toUpperCase(), x0 + w / 2, yy, F.mono(14 * u, 600), ink);
          yy += 14 * u;
          ctx.fillStyle = withA(ink, 0.25);
          ctx.fillRect(x0 + w * 0.2, yy, w * 0.6, 1 * u);
          ctx.fillStyle = ink;
        }
        // their story, then filler "story" lines below
        if (body) {
          ctx.font = F.sans(19 * u, 500);
          const ls = wrap(ctx, body, w, Math.max(1, Math.floor((R.y + R.h - yy - 40 * u) / (27 * u))));
          ls.forEach((l, i) => text(ctx, l, x0, yy + 34 * u + i * 27 * u, F.sans(19 * u, 500), ink, "left"));
          yy += ls.length * 27 * u + 10 * u;
        }
        ctx.fillStyle = withA(ink, 0.18);
        for (let ly = yy + 30 * u, i = 0; ly < R.y + R.h; ly += 26 * u, i++) ctx.fillRect(x0, ly, w * (0.7 + 0.3 * ((i * 0.37) % 1)), 9 * u);
        ctx.fillStyle = ink;
      };
      if (R.x > mx * 3) {
        const w = R.x - mx * 2;
        ctx.fillStyle = ink;
        if (f.brand) {
          column(mx, w, "THE STORY", [], story);
          column(R.x + R.w + mx, w, f.journey.name ? `${firstName(f.journey.name).toUpperCase()}'S DAY` : "IN PICTURES", []);
        } else {
          column(mx, w, "BY THE NUMBERS", left);
          column(R.x + R.w + mx, w, `${firstName(f.journey.name).toUpperCase()}'S WEEK`, right);
        }
      } else if (st) {
        // tall: one line of numbers just above the photo, under the headline
        const line = `${st.pins.toLocaleString()} PINNED · ${st.countries} ${st.countries === 1 ? "COUNTRY" : "COUNTRIES"} · ${st.states} STATES${st.attended ? `  |  ${firstName(f.journey.name).toUpperCase()}: ${st.attended} EVENT${st.attended === 1 ? "" : "S"}` : ""}`;
        text(ctx, line, W / 2, R.y - 26 * u, F.mono(17 * u, 700), ink);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(R.x - 6 * u, R.y - 6 * u, R.w + 12 * u, R.h + 12 * u);
      const fy = R.y + R.h + (f.H - R.y - R.h) / 2;
      if (f.journey.handle ?? f.journey.name) text(ctx, `Photos: ${f.journey.handle ?? f.journey.name}`, mx, fy - 18 * u, F.mono(20 * u, 600), ink, "left");
      if (creditOf(f)) text(ctx, f.brand ? creditOf(f) : "Recap: @simarpreet_019", mx, fy + 16 * u, F.mono(20 * u, 500), ink, "left");
      // the ad box: the booth's own words, else the sponsor's logo ("" leaves it off)
      const ad = wordOf(f, "newspaper.ad");
      const adLogo = f.brand?.adLogo;
      if (ad !== "" && (ad || adLogo || !f.brand || f.brand.sponsor)) {
        const bw = Math.min(W * 0.42, 460 * u);
        const bh = 84 * u;
        const bx = W - mx - bw;
        ctx.lineWidth = 2 * u;
        ctx.strokeRect(bx, fy - bh / 2, bw, bh);
        text(ctx, "ADVERTISEMENT", bx + bw / 2, fy - bh / 2 + 13 * u, F.mono(12 * u, 600), ink);
        if (ad) {
          ctx.font = F.sans(20 * u, 800);
          wrap(ctx, ad, bw - 24 * u, 2).forEach((l, i, all) => text(ctx, l, bx + bw / 2, fy + 10 * u + (i - (all.length - 1) / 2) * 24 * u, F.sans(20 * u, 800), ink));
        } else if (adLogo) {
          // their logo, centred in the box (drawn the way any uploaded logo is)
          const lh = bh - 34 * u;
          const logo = { ...f.sponsor, id: `${f.sponsor.id}-ad`, logoImage: adLogo, logo: { ...f.sponsor.logo, mark: [], word: [] } };
          const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d")!, logo, 0, 0, lh);
          dim(ctx, f, () => drawSponsorLogo(ctx, logo, bx + bw / 2 - lw / 2, fy - bh / 2 + 25 * u, lh));
        } else poweredBy(ctx, f, bx + bw / 2, fy + 10 * u, 20 * u, ink, "center");
      }
    },
  },

  pass: {
    label: "🎫 Boarding pass",
    group: "Travel",
    palettes: () => [
      P("Night flight", "#0B1424", C.gold, "#6B7280", "#F7F4EC", "#151923", C.neon, C.bg),
      P("Sunset", "#2A1030", "#FFB38A", "#8A6F78", "#FFF6EE", "#2A1A22", "#FF7A59", "#FFFFFF"),
      P("Emerald", "#06201A", "#9BE7C4", "#5E7268", "#F3F7F2", "#10261E", "#2BB673", "#FFFFFF"),
      P("First class", "#14110A", "#F2C94C", "#7A6F55", "#FBF5E6", "#1E1A10", "#F2C94C", "#14110A"),
    ],
    window: (W, H, u) => passLayout(W, H, u).R,
    marks: ["tr"],
    back(ctx, f) {
      const { u, W, H } = f;
      const j = f.journey;
      const L = passLayout(W, H, u);
      const { card, stub, head } = L;
      const { paper, ink, muted } = f.pal;
      // an airport-night backdrop with a dashed flight path
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, f.pal.bg);
      bg.addColorStop(1, mix(f.pal.bg, "#000000", 0.55));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.setLineDash([10 * u, 14 * u]);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(-40 * u, H * 0.9);
      ctx.quadraticCurveTo(W * 0.5, H * 0.2, W + 40 * u, H * 0.75);
      ctx.stroke();
      ctx.restore();
      // the ticket, with bites at the tear line
      const notch = L.wide ? { x: L.tear } : { y: L.tear };
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 40 * u;
      ctx.shadowOffsetY = 14 * u;
      ticketPath(ctx, card, 28 * u, notch, 26 * u);
      ctx.fillStyle = paper;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ticketPath(ctx, card, 28 * u, notch, 26 * u);
      ctx.clip();
      // header strip
      ctx.fillStyle = f.pal.accent;
      ctx.fillRect(card.x, card.y, card.w, 64 * u);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      if (L.wide) ctx.fillRect(stub.x, card.y, stub.w, card.h);
      else ctx.fillRect(card.x, stub.y, card.w, stub.h);
      ctx.restore();
      const px = 30 * u;
      text(ctx, `✈  ${[f.eventName.toUpperCase(), "BOARDING PASS"].filter(Boolean).join(" · ")}`, card.x + px, card.y + 33 * u, F.mono(22 * u, 800), f.pal.accent2, "left");
      text(ctx, f.eventDates.toUpperCase(), card.x + card.w - px, card.y + 33 * u, F.mono(20 * u, 700), f.pal.accent2, "right");
      // the route, big: PNQ ✈ BOM
      const ry = head.y + 128 * u;
      const big = F.display(78 * u, 900);
      const rt = routeFor(f);
      text(ctx, rt.fromCode, head.x + px, ry, big, ink, "left");
      text(ctx, rt.toCode, head.x + head.w - px, ry, big, ink, "right");
      text(ctx, rt.from, head.x + px, ry + 50 * u, F.mono(17 * u, 700), muted, "left");
      text(ctx, rt.to, head.x + head.w - px, ry + 50 * u, F.mono(17 * u, 700), muted, "right");
      ctx.font = big;
      const a = head.x + px + ctx.measureText(rt.fromCode).width + 24 * u;
      const b = head.x + head.w - px - ctx.measureText(rt.toCode).width - 24 * u;
      if (b - a > 80 * u) {
        ctx.save();
        ctx.setLineDash([8 * u, 8 * u]);
        ctx.strokeStyle = withA(ink, 0.35);
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.moveTo(a, ry);
        ctx.lineTo(b, ry);
        ctx.stroke();
        ctx.restore();
        // the plane moves along the route as the reel plays
        const k = clamp(f.t / Math.max(1, f.total));
        ctx.fillStyle = paper;
        ctx.fillRect(a + (b - a) * k - 26 * u, ry - 24 * u, 52 * u, 48 * u);
        text(ctx, "✈", a + (b - a) * k, ry, F.sans(40 * u, 700), f.pal.accent);
      }
      if (!L.wide) {
        text(ctx, f.brand ? "NON-STOP" : `${j.km.toLocaleString()} KM`, (a + b) / 2, ry + 50 * u, F.mono(17 * u, 700), muted);
      }
      // a thin frame round the photo
      ctx.strokeStyle = withA(ink, 0.18);
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(L.R.x - 4 * u, L.R.y - 4 * u, L.R.w + 8 * u, L.R.h + 8 * u);
      // the tear line
      ctx.save();
      ctx.setLineDash([12 * u, 10 * u]);
      ctx.strokeStyle = withA(ink, 0.35);
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      if (L.wide) {
        ctx.moveTo(L.tear, card.y + 34 * u);
        ctx.lineTo(L.tear, card.y + card.h - 34 * u);
      } else {
        ctx.moveTo(card.x + 34 * u, L.tear);
        ctx.lineTo(card.x + card.w - 34 * u, L.tear);
      }
      ctx.stroke();
      ctx.restore();
      // the stub: fields, barcode, ticket number
      const fields: [string, string][] = [
        ...((f.brand
          ? [
              ["GUEST", (firstName(j.name) || "Guest").toUpperCase()],
              ["GATE", (wordOf(f, "pass.gate") ?? "A1").toUpperCase() || "—"],
              ["SEAT", (wordOf(f, "pass.seat") ?? "VIP").toUpperCase() || "—"],
              ["DATE", f.eventDates.toUpperCase() || "TODAY"],
            ]
          : [
              ["PASSENGER", firstName(j.name).toUpperCase()],
              ["FLIGHT", `QP ${String(j.traveller).padStart(3, "0")}`],
              ["SEAT", j.seat],
              ["DATE", j.landing.toUpperCase()],
            ]) as Array<[string, string]>),
      ];
      const label = F.mono(14 * u, 700);
      const value = F.mono(24 * u, 800);
      if (L.wide) {
        let y = stub.y + 110 * u;
        for (const [k, v] of fields) {
          text(ctx, k, stub.x + 40 * u, y, label, muted, "left");
          text(ctx, v, stub.x + 40 * u, y + 30 * u, value, ink, "left");
          y += 82 * u;
        }
        if (f.link) {
          const room = stub.y + stub.h - 210 * u - (y - 20 * u);
          const qs = Math.min(stub.w - 140 * u, room - 30 * u);
          if (qs > 90 * u) {
            const qx = stub.x + (stub.w - qs) / 2;
            drawQr(ctx, f.link, qx, y - 20 * u, qs, ink);
            text(ctx, f.brand ? "SCAN · MAKE YOURS" : "SCAN · CONNECT", stub.x + stub.w / 2, y - 20 * u + qs + 18 * u, F.mono(13 * u, 700), muted);
          }
        }
        barcode(ctx, ticketOf(f), stub.x + 40 * u, stub.y + stub.h - 190 * u, stub.w - 80 * u, 70 * u, ink);
        text(ctx, ticketOf(f), stub.x + stub.w / 2, stub.y + stub.h - 100 * u, F.mono(17 * u, 700), ink);
        poweredBy(ctx, f, stub.x + stub.w / 2, stub.y + stub.h - 60 * u, 18 * u, muted, "center");
      } else {
        const cw = (stub.w - 60 * u) / fields.length;
        fields.forEach(([k, v], i) => {
          const x = stub.x + 30 * u + cw * i;
          text(ctx, k, x, stub.y + 56 * u, label, muted, "left");
          ctx.font = value;
          const vv = ctx.measureText(v).width > cw - 10 * u ? v.slice(0, 7) : v;
          text(ctx, vv, x, stub.y + 88 * u, value, ink, "left");
        });
        const bw = stub.w * 0.44;
        barcode(ctx, ticketOf(f), stub.x + 30 * u, stub.y + 132 * u, bw, 90 * u, ink);
        text(ctx, ticketOf(f), stub.x + 30 * u + bw / 2, stub.y + 248 * u, F.mono(16 * u, 700), ink);
        // the QR to this person's reel link, on the right of the stub
        const qs = Math.min(150 * u, stub.h - 140 * u);
        const qx = stub.x + stub.w - 30 * u - qs;
        if (f.link) {
          drawQr(ctx, f.link, qx, stub.y + 112 * u, qs, ink);
          text(ctx, f.brand ? "SCAN · MAKE YOURS" : "SCAN · CONNECT", qx + qs / 2, stub.y + 112 * u + qs + 16 * u, F.mono(12 * u, 700), muted);
        }
        const mx = (stub.x + 30 * u + bw + (f.link ? qx : stub.x + stub.w - 30 * u)) / 2;
        poweredBy(ctx, f, mx, stub.y + 165 * u, 18 * u, muted, "center");
        dim(ctx, f, () => text(ctx, creditOf(f), mx, stub.y + 210 * u, F.mono(14 * u, 500), muted));
      }
      const top = f.brand ? [f.brand.mark.toUpperCase(), f.brand.site].filter(Boolean).join(" · ") : "QUESTPASS · questpass.live";
      if (card.y > 40 * u && top) dim(ctx, f, () => text(ctx, top, W / 2, card.y / 2, F.mono(20 * u, 700), f.pal.fg));
    },
  },

  passport: {
    label: "🛂 Passport page",
    group: "Travel",
    palettes: () => [
      P("Navy ink", "#EEF0E6", "#1F2A44", "#6A7085", "#EEF0E6", "#1F2A44", "#1F4E9C", "#2F6B5E"),
      P("Red ink", "#F4EEE6", "#2A1C1A", "#7A6660", "#F4EEE6", "#2A1C1A", "#B3202A", "#8A5A2B"),
      P("Green ink", "#EAF1E6", "#1A2A1E", "#5E7262", "#EAF1E6", "#1A2A1E", "#1F7A3A", "#2F5FBF"),
      P("Purple ink", "#F1ECF4", "#241A2E", "#6E6078", "#F1ECF4", "#241A2E", "#6B2FA0", "#C0566B"),
    ],
    window: (W, H, u) => (isWide(W, H) ? capped(200, 190, 60, 1.7)(W, H, u) : capped(330, 330, 90, 1.4)(W, H, u)),
    marks: ["tr"],
    ownsDate: true,
    back(ctx, f) {
      const { u, W, H, R } = f;
      const j = f.journey;
      fill(ctx, f, f.pal.paper);
      // the page's fine wavy security pattern
      ctx.strokeStyle = withA(f.pal.accent2, 0.13);
      ctx.lineWidth = 1.5 * u;
      for (let k = 0; k < 26; k++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12 * u) {
          const y = (k / 26) * H + Math.sin(x / (70 * u) + k * 0.6) * 26 * u;
          if (x) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      const mx = Math.max(R.x, 50 * u);
      const top = R.y;
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - mx, top * 0.18, F.mono(20 * u, 700), f.pal.ink, "right"));
      const country = f.brand ? (wordOf(f, "passport.country") ?? `Republic of ${f.eventName || "Good Times"}`).toUpperCase() : "REPUBLIC OF SIDE QUESTS";
      ctx.font = F.mono(20 * u, 700);
      text(ctx, wrap(ctx, country, W * 0.6, 1)[0] ?? "", mx, top * 0.18, F.mono(20 * u, 700), f.pal.ink, "left");
      text(ctx, "VISAS", W / 2, top * 0.5, F.display(Math.min(84 * u, top * 0.32), 900), f.pal.accent2);
      text(ctx, [f.eventName.toUpperCase(), f.eventDates.toUpperCase()].filter(Boolean).join(" · "), W / 2, top * 0.78, F.mono(20 * u, 700), f.pal.muted);
      // the machine-readable lines at the foot
      const last = j.name.split(/\s+/).slice(-1)[0] ?? j.name;
      const mrz1 = `P<QSP${last.toUpperCase()}<<${firstName(j.name).toUpperCase()}`.replace(/[^A-Z0-9<]/g, "<").padEnd(40, "<").slice(0, 40);
      const prt = routeFor(f);
      const mrz2 = `${ticketOf(f).replace(/[^A-Z0-9]/gi, "").toUpperCase()}<${prt.fromCode}${prt.toCode}<<${String(j.traveller).padStart(6, "0")}`.padEnd(40, "<").slice(0, 40);
      const bot = R.y + R.h;
      const room = f.H - bot;
      ctx.font = F.mono(26 * u, 600);
      const mpx = Math.min(26 * u, (26 * u * (W - mx * 2)) / Math.max(1, ctx.measureText(mrz1).width));
      text(ctx, mrz1, W / 2, bot + room * 0.3, F.mono(mpx, 600), f.pal.ink);
      text(ctx, mrz2, W / 2, bot + room * 0.3 + mpx * 1.5, F.mono(mpx, 600), f.pal.ink);
      poweredBy(ctx, f, mx, H - room * 0.2, 20 * u, f.pal.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - mx, H - room * 0.2, F.mono(18 * u, 500), f.pal.muted, "right"));
    },
    front(ctx, f) {
      const { u, R } = f;
      ctx.strokeStyle = withA(f.pal.ink, 0.5);
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(R.x, R.y, R.w, R.h);
      // a stamp lands on each new photo; the earlier ones stay round the edges
      const d = dayOf(f);
      const when = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      const spots = [
        [R.x + 20 * u, R.y + R.h * 0.12, -0.18],
        [R.x + R.w - 20 * u, R.y + R.h * 0.34, 0.14],
        [R.x + 30 * u, R.y + R.h * 0.6, 0.1],
        [R.x + R.w - 30 * u, R.y + R.h * 0.86, -0.12],
        [R.x + R.w * 0.3, R.y + R.h - 10 * u, 0.06],
        [R.x + R.w * 0.72, R.y + 10 * u, -0.08],
      ] as const;
      const shown = f.seg ? Math.min(spots.length, f.seg.i + 1) : f.t > f.total / 2 ? spots.length : 0;
      const sw = Math.min(250 * u, R.w * 0.34);
      for (let k = 0; k < shown; k++) {
        const [x, y, rot] = spots[k]!;
        const fresh = f.seg && k === shown - 1 ? clamp(f.seg.p / 0.12) : 1;
        if (fresh <= 0) continue;
        ctx.save();
        ctx.globalAlpha = fresh;
        stamp(ctx, x, y, sw, sw * 0.56, rot, k % 2 ? f.pal.accent2 : f.pal.accent, [stampsOf(f)[k % stampsOf(f).length]!, f.brand ? (f.eventDates ? `${routeFor(f).toCode} · ${when}` : routeFor(f).toCode) : `BOM · ${when}`], u, 1 + (1 - fresh) * 0.6);
        ctx.restore();
      }
    },
  },

  ticket: {
    label: "🚆 Local train ticket",
    group: "Travel",
    palettes: () => [
      P("Classic", "#1D2B22", "#F3E9C6", "#6F6650", "#F3E9C6", "#1C1A16", "#C8102E", "#1F4E9C"),
      P("First class pink", "#3A1A28", "#F8D9E3", "#7A5163", "#F8D9E3", "#2B1420", "#B0305C", "#2E8B87"),
      P("Metro blue", "#0E1A2B", "#DCE9F7", "#50647E", "#DCE9F7", "#10233D", "#0057B8", "#F2A33A"),
      P("Mint", "#10261E", "#DDF0E4", "#4E6B5D", "#DDF0E4", "#122B20", "#1F7A3A", "#D9480F"),
    ],
    window: (W, H, u) => (isWide(W, H) ? capped(190, 230, 80, 1.8)(W, H, u) : capped(330, 420, 90, 1.4)(W, H, u)),
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H, R } = f;
      const j = f.journey;
      const { paper, ink, muted, accent } = f.pal;
      fill(ctx, f, f.pal.bg);
      const card = { x: 40 * u, y: 40 * u, w: W - 80 * u, h: H - 80 * u };
      ctx.fillStyle = paper;
      roundRect(ctx, card, 20 * u);
      ctx.fill();
      // punched holes down both edges
      ctx.fillStyle = f.pal.bg;
      for (let y = card.y + 40 * u; y < card.y + card.h - 30 * u; y += 46 * u) {
        for (const x of [card.x, card.x + card.w]) {
          ctx.beginPath();
          ctx.arc(x, y, 9 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const mx = Math.max(R.x, 80 * u);
      const top = R.y - card.y;
      // the header: line, route, fare
      ctx.fillStyle = accent;
      ctx.fillRect(card.x + 30 * u, card.y + 26 * u, card.w - 60 * u, 50 * u);
      const lineName = f.brand ? (wordOf(f, "ticket.line") ?? `${f.eventName || "Good Times"} line`).toUpperCase() : "MUMBAI LOCAL · SIDE QUEST LINE";
      ctx.font = F.mono(22 * u, 800);
      text(ctx, wrap(ctx, lineName, W - 2 * mx, 1)[0] ?? "", W / 2, card.y + 51 * u, F.mono(22 * u, 800), onColor(accent));
      const trt = routeFor(f, "ticket.from");
      const ry = card.y + 76 * u + (top - 76 * u) * 0.42;
      const big = F.display(Math.min(80 * u, top * 0.3), 900);
      text(ctx, trt.fromCode, mx, ry, big, ink, "left");
      text(ctx, trt.toCode, W - mx, ry, big, ink, "right");
      text(ctx, "→", W / 2, ry, F.sans(Math.min(64 * u, top * 0.24), 800), accent);
      text(ctx, f.brand ? ["FIRST CLASS · SINGLE JOURNEY", f.eventDates.toUpperCase()].filter(Boolean).join(" · ") : `FIRST CLASS · SINGLE JOURNEY · ₹ 0.00 · ${f.eventDates.toUpperCase()}`, W / 2, card.y + 76 * u + (top - 76 * u) * 0.8, F.mono(17 * u, 700), muted);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(R.x - 5 * u, R.y - 5 * u, R.w + 10 * u, R.h + 10 * u);
      // the line map: stations, the train moving along as the reel plays
      const bot = R.y + R.h;
      const room = card.y + card.h - bot;
      const ly = bot + room * 0.3;
      const own = wordOf(f, "ticket.stops")?.split(",").map((x) => x.trim().toUpperCase().slice(0, 12)).filter(Boolean);
      const stops = f.brand ? [trt.fromCode, ...(own?.length ? own : ["PHOTOS", "SNACKS", "DANCING"]).slice(0, 3), trt.toCode] : [j.code, "STAGE", "CHAI", "SIDE QUESTS", "BOM"];
      const x0 = mx + 20 * u;
      const x1 = W - mx - 20 * u;
      ctx.strokeStyle = withA(ink, 0.4);
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      ctx.moveTo(x0, ly);
      ctx.lineTo(x1, ly);
      ctx.stroke();
      stops.forEach((s, i) => {
        const x = x0 + ((x1 - x0) * i) / (stops.length - 1);
        ctx.fillStyle = paper;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.arc(x, ly, 12 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        text(ctx, s, x, ly + 36 * u, F.mono(15 * u, 700), muted, i === 0 ? "left" : i === stops.length - 1 ? "right" : "center");
      });
      const k = clamp(f.t / Math.max(1, f.total));
      ctx.fillStyle = accent;
      roundRect(ctx, { x: x0 + (x1 - x0) * k - 26 * u, y: ly - 14 * u, w: 52 * u, h: 28 * u }, 10 * u);
      ctx.fill();
      text(ctx, `TICKET ${ticketOf(f)}`, mx, card.y + card.h - room * 0.28, F.mono(18 * u, 700), ink, "left");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - mx, card.y + card.h - room * 0.28, F.mono(18 * u, 700), ink, "right"));
      poweredBy(ctx, f, mx, card.y + card.h - room * 0.12, 18 * u, muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - mx, card.y + card.h - room * 0.12, F.mono(16 * u, 500), muted, "right"));
    },
  },

  polaroid: {
    label: "📸 Polaroid",
    group: "Clean",
    palettes: () => [
      P("Night", C.bg, C.neon, C.grey, "#FAF8F3", "#2A2622", C.gold, C.gold),
      P("Cork board", "#A47B52", "#FFF8EC", "#F1DFC5", "#FAF8F3", "#2A2622", "#3A2414", "#3A2414"),
      P("Blush", "#F4C9D6", "#5A1E33", "#8A5466", "#FFFDF9", "#3A2630", "#B0305C", "#B0305C"),
      P("Mint", "#BFE6D5", "#123D2E", "#3F6B5B", "#FFFFFF", "#23302A", "#0E7A55", "#0E7A55"),
      P("Black", "#0A0A0A", "#FFFFFF", "#9A9A9A", "#F5F5F2", "#111111", "#FF4F4F", "#FF4F4F"),
    ],
    window: capped(130, 250, 110, 1.4),
    tilt: -0.025,
    back(ctx, f) {
      const { u, R } = f;
      fill(ctx, f, f.pal.bg);
      const card = { x: R.x - 30 * u, y: R.y - 30 * u, w: R.w + 60 * u, h: R.h + 170 * u };
      ctx.save();
      ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
      ctx.rotate(-0.025);
      ctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRect(ctx, { ...card, x: card.x + 10 * u, y: card.y + 14 * u }, 6 * u);
      ctx.fill();
      ctx.fillStyle = f.pal.paper;
      roundRect(ctx, card, 6 * u);
      ctx.fill();
      text(ctx, f.brand ? [firstName(f.journey.name), f.eventName].filter(Boolean).join(" · ") : `${firstName(f.journey.name)} · Mumbai '26`, R.x + R.w / 2, R.y + R.h + 82 * u, `italic 600 ${42 * u}px Georgia, serif`, f.pal.ink);
      ctx.restore();
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted, card.y, card.y + card.h);
    },
  },

  film: {
    label: "🎞️ Film strip",
    group: "Retro",
    palettes: () => [
      P("Black", "#111111", "#EEEEEE", "#A6A6A6", "#EEEEEE", "#111111", C.gold, C.gold),
      P("Sepia", "#2B1D12", "#F2E3C6", "#BFA88A", "#F2E3C6", "#2B1D12", "#E0A458", "#E0A458"),
      P("Navy", "#0D1B2A", "#E0E6EE", "#94A3B8", "#E0E6EE", "#0D1B2A", "#7FB7FF", "#7FB7FF"),
      P("Red", "#3A0D0D", "#F5E6E6", "#C9A0A0", "#F5E6E6", "#3A0D0D", "#FFC440", "#FFC440"),
    ],
    window: banded(100, 100, 90),
    back(ctx, f) {
      const { u, R } = f;
      fill(ctx, f, f.pal.bg);
      ctx.fillStyle = f.pal.paper;
      const hw = 22 * u;
      const hh = 30 * u;
      for (let y = R.y; y < R.y + R.h - hh; y += hh * 1.9) {
        roundRect(ctx, { x: R.x - hw * 1.8, y, w: hw, h: hh }, 4 * u);
        ctx.fill();
        roundRect(ctx, { x: R.x + R.w + hw * 0.8, y, w: hw, h: hh }, 4 * u);
        ctx.fill();
      }
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted);
    },
  },

  cinema: {
    label: "🎬 After-movie",
    group: "Retro",
    palettes: () => [
      P("Black", "#000000", "#FFFFFF", "#9A9A9A", "#000000", "#FFFFFF", C.gold, C.gold),
      P("Midnight", "#06101F", "#E8F0FF", "#8597B5", "#06101F", "#E8F0FF", "#7FB7FF", "#7FB7FF"),
      P("Wine", "#1C0710", "#FFE8EF", "#B8899A", "#1C0710", "#FFE8EF", "#FF7AB6", "#FF7AB6"),
      P("White", "#F5F3EE", "#111111", "#6B6A66", "#F5F3EE", "#111111", "#C8102E", "#C8102E"),
    ],
    window: banded(150, 150, 0),
    marks: ["tl", "tr", "bl"],
    back(ctx, f) {
      const { u, R, W } = f;
      fill(ctx, f, f.pal.bg);
      const who = f.journey.name.toUpperCase();
      text(ctx, f.brand ? (who ? `STARRING ${who}` : "NOW SHOWING") : who ? `${who}  ·  IN` : "NOW SHOWING", W / 2, R.y / 2 - 16 * u, F.mono(20 * u, 600), f.pal.muted, "center");
      // the title, shrunk to fit on one line (a long one used to run off both sides)
      const story = f.brand ? f.eventName.toUpperCase() || "OUR STORY" : `A ${f.eventName.toUpperCase()} STORY`;
      ctx.font = F.display(40 * u, 900);
      const spx = Math.min(40 * u, (40 * u * (W - 80 * u)) / Math.max(1, ctx.measureText(story).width));
      text(ctx, story, W / 2, R.y / 2 + 20 * u, F.display(spx, 900), f.pal.fg);
      const by = R.y + R.h + (f.H - R.y - R.h) / 2;
      poweredBy(ctx, f, W / 2, by - 18 * u, 20 * u, f.pal.muted, "center");
      dim(ctx, f, () => text(ctx, signOf(f), W / 2, by + 24 * u, F.mono(18 * u, 500), f.pal.muted));
    },
    front(ctx, f) {
      // REC-style timecode in the corner of the picture
      const s = Math.floor(f.t);
      const tc = `00:00:${String(s).padStart(2, "0")}:${String(Math.floor((f.t % 1) * 24)).padStart(2, "0")}`;
      text(ctx, tc, f.R.x + f.R.w - 30 * f.u, f.R.y + f.R.h - 34 * f.u, F.mono(22 * f.u, 600), "rgba(255,255,255,0.8)", "right");
    },
  },

  vhs: {
    label: "📼 VHS",
    group: "Retro",
    palettes: () => [
      P("Red", "#000000", "#EEEEEE", "#A6A6A6", "#000000", "#EEEEEE", "#FF4F4F", "#FF3030"),
      P("Green screen", "#000000", "#D8FFD0", "#7FAF7A", "#000000", "#D8FFD0", "#39FF14", "#39FF14"),
      P("Blue screen", "#0033AA", "#FFFFFF", "#C9D6F5", "#0033AA", "#FFFFFF", "#FFE14D", "#FF3030"),
      P("Purple", "#160A2A", "#F1E6FF", "#A794C4", "#160A2A", "#F1E6FF", "#C77DFF", "#FF3030"),
    ],
    window: banded(70, 70, 0),
    marks: ["br"],
    ownsDate: true,
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted);
    },
    front(ctx, f) {
      const { u, R, t } = f;
      const px = 30 * u;
      // REC dot blinks; PLAY and the date in the camcorder font
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = f.pal.accent2;
        ctx.beginPath();
        ctx.arc(R.x + 46 * u, R.y + 50 * u, 12 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      text(ctx, "REC", R.x + 68 * u, R.y + 50 * u, F.mono(px, 700), "#FFFFFF", "left");
      text(ctx, "PLAY ▶", R.x + R.w - 40 * u, R.y + 50 * u, F.mono(px, 700), "#FFFFFF", "right");
      // the camcorder's own date: the photo's, else a day of the event week
      const [y, mo, d] = (f.date ?? "").split("-");
      const day = y && mo && d ? `${MONTHS[Number(mo) - 1] ?? "NOV"} ${Number(d)} ${y}` : `NOV ${3 + Math.min(3, Math.floor((t / f.total) * 4))} 2026`;
      dim(ctx, f, () => text(ctx, `${day}  MUMBAI`, R.x + 40 * u, R.y + R.h - 46 * u, F.mono(px, 700), "#FFFFFF", "left"));
      // scan lines
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let yy = R.y; yy < R.y + R.h; yy += 4 * u) ctx.fillRect(R.x, yy, R.w, 1.5 * u);
    },
  },

  postcard: {
    label: "💌 Postcard",
    group: "Retro",
    palettes: () => [
      P("Airmail", "#E9DFC9", "#3A3226", "#5A5040", "#FFFDF7", "#3A3226", "#C8102E", "#1F4E9C"),
      P("Sky", "#CFE3F2", "#1E3346", "#4A6378", "#FFFFFF", "#1E3346", "#1F6FB2", "#F2A33A"),
      P("Blush", "#F3D4D8", "#43262C", "#7A5560", "#FFFBFA", "#43262C", "#D94F70", "#2E8B87"),
      P("Night", "#1B2233", "#F2EDE3", "#A9B0C0", "#FFFDF7", "#2B2B33", "#FF6B6B", "#6FA8FF"),
    ],
    window: capped(200, 230, 70, 1.6),
    marks: ["bl", "br", "tl"],
    back(ctx, f) {
      const { u, R, W } = f;
      const p = f.pal;
      fill(ctx, f, p.bg);
      const card = { x: R.x - 26 * u, y: R.y - 26 * u, w: R.w + 52 * u, h: R.h + 52 * u };
      ctx.fillStyle = p.paper;
      roundRect(ctx, card, 8 * u);
      ctx.fill();
      // airmail border
      ctx.save();
      roundRect(ctx, card, 8 * u);
      ctx.clip();
      for (let i = -card.h; i < card.w + card.h; i += 36 * u) {
        ctx.fillStyle = (i / (36 * u)) % 2 ? p.accent : p.accent2;
        ctx.beginPath();
        ctx.moveTo(card.x + i, card.y);
        ctx.lineTo(card.x + i + 18 * u, card.y);
        ctx.lineTo(card.x + i + 18 * u - card.h, card.y + card.h);
        ctx.lineTo(card.x + i - card.h, card.y + card.h);
        ctx.fill();
      }
      ctx.fillStyle = p.paper;
      ctx.fillRect(card.x + 12 * u, card.y + 12 * u, card.w - 24 * u, card.h - 24 * u);
      ctx.restore();
      const ty = card.y / 2;
      text(ctx, "Greetings from", W / 2, ty - 28 * u, `italic 600 ${32 * u}px Georgia, serif`, p.fg);
      {
        const where = (f.brand ? f.eventName : "Mumbai").toUpperCase();
        ctx.font = F.display(52 * u, 900);
        const wpx = Math.min(52 * u, (52 * u * (W - 80 * u)) / Math.max(1, ctx.measureText(where).width));
        text(ctx, where, W / 2, ty + 20 * u, F.display(wpx, 900), p.accent);
      }
      const bt = card.y + card.h;
      const by = bt + (f.H - bt) / 2;
      ctx.font = `italic 600 ${30 * u}px Georgia, serif`;
      const sign = f.journey.name ? ` — ${firstName(f.journey.name)}` : "";
      const own = (wordOf(f, "postcard.message") ?? f.note)?.trim();
      const note = own
        ? [`${own}${sign}`, own].find((s) => ctx.measureText(s).width < card.w) ?? wrap(ctx, own, card.w, 1)[0] ?? own
        : f.brand
          ? ([`Wish you were here!${sign}`].find((s) => ctx.measureText(s).width < card.w) ?? "Wish you were here!")
          : ([`Side quests unlocked at ${f.eventName}!${sign}`, `Side quests unlocked!${sign}`].find((s) => ctx.measureText(s).width < card.w) ?? "Side quests unlocked!");
      text(ctx, note, W / 2, by - 34 * u, `italic 600 ${30 * u}px Georgia, serif`, p.fg);
      // sponsor and credit on their own rows when the card is narrow, side by side when wide
      if (W > 1.3 * f.H) {
        poweredBy(ctx, f, card.x, by + 30 * u, 20 * u, p.muted, "left");
        dim(ctx, f, () => text(ctx, signOf(f), card.x + card.w, by + 30 * u, F.mono(18 * u, 500), p.muted, "right"));
      } else {
        poweredBy(ctx, f, W / 2, by + 18 * u, 20 * u, p.muted, "center");
        dim(ctx, f, () => text(ctx, signOf(f), W / 2, by + 54 * u, F.mono(18 * u, 500), p.muted));
      }
    },
    front(ctx, f) {
      // a stamp and postmark on the corner
      const { u, R } = f;
      const s = { x: R.x + R.w - 130 * u, y: R.y + 20 * u, w: 110 * u, h: 130 * u };
      ctx.fillStyle = f.pal.paper;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = f.pal.accent;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(s.x + 8 * u, s.y + 8 * u, s.w - 16 * u, s.h - 16 * u);
      text(ctx, f.brand ? "★" : "BOM", s.x + s.w / 2, s.y + 52 * u, F.mono(30 * u, 800), f.pal.accent);
      text(ctx, f.brand ? "POST" : "₹ 5", s.x + s.w / 2, s.y + 92 * u, F.mono(22 * u, 700), f.pal.accent2);
    },
  },

  scrapbook: {
    label: "📒 Scrapbook",
    group: "Retro",
    palettes: () => [
      P("Kraft", "#F4E7D3", "#3A2E22", "#6A5A48", "#F4E7D3", "#5A78AA", "#B4552B", "#F0BE5A"),
      P("Mint", "#E3F2EA", "#1F3A2E", "#4E6B5D", "#E3F2EA", "#4E8A75", "#2E8B57", "#F7A6B8"),
      P("Lavender", "#ECE6F7", "#2E2440", "#6A5E80", "#ECE6F7", "#7A6AB0", "#7B4FC9", "#9FD8CB"),
      P("Lemon", "#FFF6D6", "#3A3010", "#7A6A35", "#FFF6D6", "#C9A227", "#D9480F", "#74C0FC"),
    ],
    window: capped(150, 200, 90, 1.5),
    tilt: 0.02,
    marks: ["tr", "bl"],
    back(ctx, f) {
      const { u, R, W } = f;
      fill(ctx, f, f.pal.bg);
      // ruled paper
      ctx.strokeStyle = withA(f.pal.ink, 0.18);
      ctx.lineWidth = 2 * u;
      for (let y = 40 * u; y < f.H; y += 48 * u) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // the event and QuestPass on a line of their own above the title (they used to sit on it)
      const title = f.brand ? [firstName(f.journey.name) && `${firstName(f.journey.name)}'s`, f.eventName || "diary"].filter(Boolean).join(" ") : `${firstName(f.journey.name)}'s Mumbai diary`;
      ctx.font = `italic 700 ${44 * u}px Georgia, serif`;
      const tpx = Math.min(44 * u, (44 * u * (W - 120 * u)) / Math.max(1, ctx.measureText(title).width));
      text(ctx, title, W / 2, R.y * 0.7, `italic 700 ${tpx}px Georgia, serif`, f.pal.fg);
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted, R.y * 0.5, R.y + R.h);
    },
    front(ctx, f) {
      // washi tape on two corners
      const { u, R } = f;
      const tape = (x: number, y: number, a: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = withA(f.pal.accent2, 0.8);
        ctx.fillRect(-90 * u, -22 * u, 180 * u, 44 * u);
        ctx.restore();
      };
      tape(R.x + 10 * u, R.y + 10 * u, -0.7);
      tape(R.x + R.w - 10 * u, R.y + R.h - 10 * u, -0.7);
    },
  },

  magazine: {
    label: "📖 Magazine cover",
    group: "Clean",
    palettes: () => [
      P("Classic", "#000000", "#FFFFFF", "#CCCCCC", "#000000", "#FFFFFF", C.gold, C.gold),
      P("Red masthead", "#000000", "#E3262E", "#CCCCCC", "#000000", "#FFFFFF", "#FFFFFF", "#FFFFFF"),
      P("Yellow", "#000000", "#FFD400", "#CCCCCC", "#000000", "#FFFFFF", "#FFFFFF", "#FFFFFF"),
      P("Pink", "#000000", "#FF6FB5", "#CCCCCC", "#000000", "#FFFFFF", "#FFE14D", "#FFE14D"),
    ],
    window: banded(0, 0, 0),
    // its own masthead and footer carry the branding
    marks: [],
    ownsText: true,
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
    },
    front(ctx, f) {
      const { u, W, H } = f;
      // a readable shade at top and bottom, then the masthead over the photo
      const top = ctx.createLinearGradient(0, 0, 0, 320 * u);
      top.addColorStop(0, "rgba(0,0,0,0.65)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 320 * u);
      const bot = ctx.createLinearGradient(0, H - 360 * u, 0, H);
      bot.addColorStop(0, "rgba(0,0,0,0)");
      bot.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = bot;
      ctx.fillRect(0, H - 360 * u, W, 360 * u);
      // the event is the masthead (shrunk to fit), the side quest and QuestPass under it
      const mast = f.eventName.toUpperCase();
      ctx.font = F.display(120 * u, 900);
      const mpx = Math.min(120 * u, (120 * u * (W - 100 * u)) / Math.max(1, ctx.measureText(mast).width));
      text(ctx, mast, W / 2, 50 * u + mpx * 0.5, F.display(mpx, 900), f.pal.fg);
      text(ctx, (f.brand ? ["SPECIAL ISSUE", markOf(f).toUpperCase(), f.eventDates.toUpperCase()].filter(Boolean).join(" · ") : `SIDE QUEST ISSUE · QUESTPASS · ${f.eventDates.toUpperCase()}`), W / 2, 80 * u + mpx, F.mono(22 * u, 700), f.pal.accent);
      // the cover line waits until the name card (with its own "Recap powered by") has gone
      const k = Math.min(clamp((f.t - 2.8) / 0.4), 1 - (f.t > 3 ? f.promo ?? 0 : 0));
      if (k > 0) {
        ctx.save();
        ctx.globalAlpha = k;
        ctx.font = F.sans(44 * u, 800);
        const lines = wrap(ctx, wordOf(f, "magazine.cover") ?? f.text, W - 120 * u, 2);
        lines.forEach((l, i) => text(ctx, l, 60 * u, H - 210 * u + i * 54 * u, F.sans(44 * u, 800), f.pal.ink, "left"));
        ctx.restore();
      }
      poweredBy(ctx, f, 60 * u, H - 70 * u, 20 * u, "rgba(255,255,255,0.8)", "left");
      dim(ctx, f, () => text(ctx, signOf(f), W - 60 * u, H - 70 * u, F.mono(18 * u, 500), "rgba(255,255,255,0.7)", "right"));
    },
  },

  calendar: {
    label: "📅 Calendar page",
    group: "Clean",
    palettes: () => [
      P("Red", "#2A2F38", "#FFFFFF", "#8A8A8A", "#FFFFFF", "#1A1A1A", "#E03A3A", "#E03A3A"),
      P("Blue", "#1E2633", "#FFFFFF", "#8A8A8A", "#FFFFFF", "#1A1A1A", "#2F6FDB", "#2F6FDB"),
      P("Green", "#1F2A24", "#FFFFFF", "#8A8A8A", "#FFFFFF", "#1A1A1A", "#1F9D55", "#1F9D55"),
      P("Marigold", "#2E2416", "#FFFFFF", "#8A8A8A", "#FFFBF2", "#1A1A1A", "#F59E0B", "#F59E0B"),
      P("Black", "#D9D6CF", "#111111", "#8A8A8A", "#FFFFFF", "#111111", "#111111", "#111111"),
    ],
    window: (W, H, u) => calLayout(W, H, u).R,
    marks: ["tr", "br"],
    ownsDate: true,
    back(ctx, f) {
      const { u, W, H } = f;
      const L = calLayout(W, H, u);
      const { sheet, R } = L;
      const p = f.pal;
      fill(ctx, f, p.bg);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 30 * u;
      ctx.shadowOffsetY = 10 * u;
      ctx.fillStyle = p.paper;
      roundRect(ctx, sheet, 18 * u);
      ctx.fill();
      ctx.restore();
      // the month band and the rings
      const band = (L.wide ? 80 : 110) * u;
      ctx.save();
      roundRect(ctx, sheet, 18 * u);
      ctx.clip();
      ctx.fillStyle = p.accent;
      ctx.fillRect(sheet.x, sheet.y, sheet.w, band);
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const x = sheet.x + sheet.w * (0.1 + i * 0.16);
        ctx.fillStyle = mix(p.bg, "#000000", 0.3);
        ctx.beginPath();
        ctx.arc(x, sheet.y + 22 * u, 11 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#C9CCD2";
        ctx.lineWidth = 6 * u;
        ctx.beginPath();
        ctx.moveTo(x, sheet.y - 20 * u);
        ctx.lineTo(x, sheet.y + 22 * u);
        ctx.stroke();
      }
      const d = dayOf(f);
      const on = onColor(p.accent);
      text(ctx, `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, sheet.x + 40 * u, sheet.y + band * 0.62, F.mono(30 * u, 800), on, "left");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), sheet.x + sheet.w - 40 * u, sheet.y + band * 0.62, F.mono(22 * u, 700), on, "right"));
      // the big day, its weekday, which day of the event
      const dy = sheet.y + band + (R.y - sheet.y - band) / 2;
      const big = F.display(Math.min(180 * u, (R.y - sheet.y - band) * 0.8), 900);
      text(ctx, String(d.getDate()), sheet.x + 40 * u, dy + 6 * u, big, p.accent, "left");
      ctx.font = big;
      const nx = sheet.x + 40 * u + ctx.measureText(String(d.getDate())).width + 30 * u;
      text(ctx, WEEKDAYS[d.getDay()]!, nx, dy - 24 * u, F.mono(30 * u, 800), p.ink, "left");
      text(ctx, titleAt(f), nx, dy + 22 * u, F.sans(28 * u, 700), p.muted, "left");
      text(ctx, firstName(f.journey.name), sheet.x + sheet.w - 40 * u, dy + 22 * u, `italic 700 ${34 * u}px Georgia, serif`, p.accent, "right");
      const fy = R.y + R.h + (sheet.y + sheet.h - R.y - R.h) / 2;
      poweredBy(ctx, f, sheet.x + 40 * u, fy, 20 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), sheet.x + sheet.w - 40 * u, fy, F.mono(18 * u, 500), p.muted, "right"));
    },
  },

  player: {
    label: "🎧 Now playing",
    group: "Clean",
    palettes: () => [
      P("Green", "#1E3A2B", "#FFFFFF", "#A7B3AC", "#0B0F0D", "#FFFFFF", "#1ED760", "#1ED760"),
      P("Purple", "#3B1E5A", "#FFFFFF", "#B9A8CC", "#0E0A14", "#FFFFFF", "#C77DFF", "#C77DFF"),
      P("Orange", "#6A2B12", "#FFFFFF", "#D2B3A6", "#140A06", "#FFFFFF", "#FF8A3D", "#FF8A3D"),
      P("Light", "#F2F2F2", "#111111", "#666666", "#D6D6D6", "#111111", "#E03A3A", "#E03A3A"),
    ],
    window: (W, H, u) => playerLayout(W, H, u).R,
    marks: ["tl", "tr"],
    ownsText: true,
    back(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const { R, info } = playerLayout(W, H, u);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, p.bg);
      g.addColorStop(1, p.paper);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const ty = isWide(W, H) ? 60 * u : R.y * 0.4;
      text(ctx, "⌄", 60 * u, ty, F.sans(44 * u, 700), p.fg, "left");
      text(ctx, "⋯", W - 60 * u, ty, F.sans(44 * u, 700), p.fg, "right");
      dim(ctx, f, () => text(ctx, markOf(f) ? `PLAYING FROM ${markOf(f).toUpperCase()}` : "NOW PLAYING", W / 2, ty - 18 * u, F.mono(17 * u, 700), p.muted));
      text(ctx, titleAt(f), W / 2, ty + 18 * u, F.sans(24 * u, 800), p.fg);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 40 * u;
      ctx.fillStyle = "#000";
      ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.restore();
      // the song: this photo's line (or the reel's), by the person
      const y0 = info.y + 30 * u;
      ctx.font = F.sans(46 * u, 800);
      const title = wrap(ctx, f.text, info.w - 80 * u, 1)[0] ?? "";
      text(ctx, title, info.x, y0, F.sans(46 * u, 800), p.fg, "left");
      text(ctx, f.journey.name, info.x, y0 + 50 * u, F.sans(28 * u, 600), p.muted, "left");
      text(ctx, "♥", info.x + info.w, y0 + 20 * u, F.sans(48 * u, 700), p.accent, "right");
      const by = y0 + 130 * u;
      const k = clamp(f.t / Math.max(1, f.total));
      ctx.fillStyle = withA(p.fg, 0.25);
      roundRect(ctx, { x: info.x, y: by - 4 * u, w: info.w, h: 8 * u }, 4 * u);
      ctx.fill();
      ctx.fillStyle = p.fg;
      roundRect(ctx, { x: info.x, y: by - 4 * u, w: info.w * k, h: 8 * u }, 4 * u);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(info.x + info.w * k, by, 13 * u, 0, Math.PI * 2);
      ctx.fill();
      const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      text(ctx, mmss(f.t), info.x, by + 38 * u, F.mono(20 * u, 600), p.muted, "left");
      text(ctx, `-${mmss(Math.max(0, f.total - f.t))}`, info.x + info.w, by + 38 * u, F.mono(20 * u, 600), p.muted, "right");
      const cy = by + 140 * u;
      const cx = info.x + info.w / 2;
      const gap = Math.min(170 * u, info.w / 4.6);
      text(ctx, "⇄", cx - gap * 2, cy, F.sans(40 * u, 700), p.accent, "center");
      text(ctx, "⏮", cx - gap, cy, F.sans(52 * u, 700), p.fg, "center");
      ctx.fillStyle = p.fg;
      ctx.beginPath();
      ctx.arc(cx, cy, 62 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix(p.paper, "#000000", 0.2);
      ctx.fillRect(cx - 20 * u, cy - 24 * u, 13 * u, 48 * u);
      ctx.fillRect(cx + 7 * u, cy - 24 * u, 13 * u, 48 * u);
      text(ctx, "⏭", cx + gap, cy, F.sans(52 * u, 700), p.fg, "center");
      text(ctx, "↻", cx + gap * 2, cy, F.sans(44 * u, 700), p.muted, "center");
      const fy = Math.min(H - 50 * u, cy + 130 * u);
      poweredBy(ctx, f, info.x, fy, 20 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), info.x + info.w, fy, F.mono(17 * u, 500), p.muted, "right"));
    },
  },

  tablet: {
    label: "📱 Tablet",
    group: "For devs",
    palettes: () => [
      P("Space grey", "#1E2A3A", "#E8EDF5", "#9AA6B6", "#16171B", "#5C6370", C.neon, C.neon),
      P("Silver", "#DCE3EC", "#1B2330", "#5A6577", "#E9ECF0", "#A9B0BA", "#2F5FBF", "#2F5FBF"),
      P("Rose gold", "#F3D9D2", "#4A2A28", "#8A625D", "#F6E3DD", "#C99A8E", "#C0566B", "#C0566B"),
      P("Midnight green", "#0E2A24", "#E4F2EC", "#8FB0A5", "#13201C", "#4F6B62", "#4CD3A5", "#4CD3A5"),
    ],
    window: capped(170, 170, 90, 1.45),
    marks: ["bl", "br"],
    back(ctx, f) {
      const { u, R, W } = f;
      const p = f.pal;
      deep(ctx, f, p.bg, 0.6);
      const b = 30 * u;
      const body = { x: R.x - b, y: R.y - b, w: R.w + b * 2, h: R.h + b * 2 };
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, { ...body, x: body.x + 8 * u, y: body.y + 14 * u }, 56 * u);
      ctx.fill();
      ctx.fillStyle = p.paper;
      roundRect(ctx, body, 56 * u);
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 3 * u;
      ctx.stroke();
      // front camera in the top bezel
      ctx.fillStyle = mix(p.paper, "#5C6370", 0.5);
      ctx.beginPath();
      ctx.arc(W / 2, body.y + b / 2, 6 * u, 0, Math.PI * 2);
      ctx.fill();
      bands(ctx, f, p.fg, p.accent, p.muted, body.y, body.y + body.h);
    },
    front(ctx, f) {
      // status bar along the top of the screen
      const { u, R, t } = f;
      const y = R.y + 22 * u;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(R.x, R.y, R.w, 44 * u);
      text(ctx, `9:${String(41 + Math.floor(t / 10)).padStart(2, "0")}`, R.x + 24 * u, y, F.sans(20 * u, 700), "#FFFFFF", "left");
      text(ctx, placeOf(f), R.x + R.w / 2, y, F.sans(18 * u, 600), "rgba(255,255,255,0.85)");
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2 * u;
      const bx = R.x + R.w - 64 * u;
      ctx.strokeRect(bx, y - 9 * u, 38 * u, 18 * u);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(bx + 3 * u, y - 6 * u, 26 * u, 12 * u);
      ctx.fillRect(bx + 39 * u, y - 4 * u, 3 * u, 8 * u);
    },
  },

  code: {
    label: "💻 Code editor",
    group: "For devs",
    // ink: plain code, fg: strings, accent2: keywords, muted: comments, accent: the status bar
    palettes: () => [
      P("Dark", "#1E1E1E", "#CE9178", "#6A9955", "#252526", "#D4D4D4", "#007ACC", "#569CD6"),
      P("Night purple", "#282A36", "#F1FA8C", "#6272A4", "#21222C", "#F8F8F2", "#BD93F9", "#FF79C6"),
      P("Light", "#FDF6E3", "#2AA198", "#93A1A1", "#EEE8D5", "#586E75", "#268BD2", "#859900"),
      P("Lime", "#272822", "#E6DB74", "#75715E", "#1E1F1C", "#F8F8F2", "#A6E22E", "#F92672"),
    ],
    window: codeWindow,
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H, R } = f;
      const p = f.pal;
      const j = f.journey;
      fill(ctx, f, p.bg);
      // title bar: three dots, the file's tab
      const bar = CODE.bar * u;
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, bar);
      ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(40 * u + i * 34 * u, bar / 2, 11 * u, 0, Math.PI * 2);
        ctx.fill();
      });
      const file = `${firstName(j.name).toLowerCase().replace(/[^a-z0-9]+/g, "")}_${f.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.tsx`;
      ctx.fillStyle = p.bg;
      ctx.font = F.mono(20 * u, 600);
      const tw = ctx.measureText(file).width + 50 * u;
      ctx.fillRect(160 * u, 12 * u, tw, bar - 12 * u);
      text(ctx, file, 160 * u + tw / 2, bar / 2 + 6 * u, F.mono(20 * u, 600), p.ink);
      dim(ctx, f, () => text(ctx, markOf(f), W - 30 * u, bar / 2, F.mono(18 * u, 700), p.muted, "right"));
      // the gutter: line numbers all the way down
      const lh = CODE.line * u;
      const gw = CODE.gutter * u;
      const first = bar + 30 * u;
      const px = 26 * u;
      let n = 1;
      for (let y = first; y < H - CODE.status * u - lh / 2; y += lh) {
        if (y > R.y - lh / 2 && y < R.y + R.h + lh / 2) {
          n++;
          continue;
        }
        text(ctx, String(n++), gw - 26 * u, y, F.mono(20 * u, 500), withA(p.ink, 0.35), "right");
      }
      const kw = p.accent2;
      const s = p.fg;
      const ink = p.ink;
      const maxW = W - gw - 40 * u;
      const ev = f.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (f.brand) {
        const crt = routeFor(f, "code.from");
        codeLine(ctx, gw, first, px, [["import", kw], [" { goodTimes } ", ink], ["from", kw], [` "${ev || "snap"}"`, s], [";", ink]], maxW);
        codeLine(ctx, gw, first + lh, px, [["const", kw], [" trip = { from: ", ink], [`"${crt.from.toLowerCase()}"`, s], [", to: ", ink], [`"${crt.to.toLowerCase()}"`, s], [" };", ink]], maxW);
      } else {
        codeLine(ctx, gw, first, px, [["import", kw], [" { mumbai } ", ink], ["from", kw], [` "${ev}"`, s], [";", ink]], maxW);
        codeLine(ctx, gw, first + lh, px, [["const", kw], [" trip = { from: ", ink], [`"${j.code}"`, s], [", to: ", ink], ['"BOM"', s], [`, km: ${j.km} };`, ink]], maxW);
      }
      codeLine(ctx, gw, first + lh * 2, px, [["return", kw], [" (", ink]], maxW);
      const below = R.y + R.h + 26 * u + lh / 2;
      codeLine(ctx, gw, below, px, [[");", ink]], maxW);
      codeLine(ctx, gw, below + lh, px, [[`// ${f.text}`, p.muted]], maxW);
      dim(ctx, f, () => {
        text(ctx, "// ", gw, below + lh * 2, F.mono(px, 500), p.muted, "left");
        ctx.font = F.mono(px, 500);
        poweredByNow(ctx, f, gw + ctx.measureText("// ").width, below + lh * 2, px * 0.85, p.muted, "left");
      });
      const who = firstName(j.name).replace(/[^A-Za-z0-9]/g, "") || "My";
      codeLine(ctx, gw, below + lh * 3, px, [["export default", kw], [` ${who}s${f.brand ? "Day" : "Week"};`, ink]], maxW);
      // the status bar
      const sb = CODE.status * u;
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, H - sb, W, sb);
      const on = onColor(p.accent);
      text(ctx, f.brand ? `⎇ main  ●  ${f.eventName || "snap"}` : `⎇ main  ●  ${f.eventName}  ·  ${j.km.toLocaleString()} km`, 30 * u, H - sb / 2, F.mono(18 * u, 700), on, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 30 * u, H - sb / 2, F.mono(17 * u, 600), on, "right"));
      ctx.strokeStyle = withA(p.ink, 0.25);
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(R.x - 3 * u, R.y - 3 * u, R.w + 6 * u, R.h + 6 * u);
    },
  },

  lanyard: {
    label: "🪪 Lanyard badge",
    group: "For devs",
    palettes: () => [
      P("Blue strap", "#F4F4F1", "#111216", "#6B6F78", "#FFFFFF", "#111216", C.neon, C.neon),
      P("Red strap", "#F4F1F0", "#111216", "#6B6F78", "#FFFFFF", "#111216", "#E03A3A", "#E03A3A"),
      P("Green strap", "#F1F4F1", "#111216", "#6B6F78", "#FFFFFF", "#111216", "#22A06B", "#22A06B"),
      P("Purple strap", "#F3F1F6", "#111216", "#6B6F78", "#FFFFFF", "#111216", "#7B4FC9", "#7B4FC9"),
      P("Black & gold", "#1A1A1D", "#FFFFFF", "#6B6F78", "#FFFFFF", "#111216", "#F2C94C", "#F2C94C"),
    ],
    window: (W, H, u) => badgeLayout(W, H, u).R,
    marks: ["tl"],
    back(ctx, f) {
      const { u, W, H } = f;
      const j = f.journey;
      const L = badgeLayout(W, H, u);
      const { badge, info } = L;
      const ink = f.pal.ink;
      const grey = f.pal.muted;
      // a clean studio background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, f.pal.bg);
      bg.addColorStop(1, mix(f.pal.bg, "#000000", 0.1));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // the lanyard: two straps meeting at the clip, the event printed along them
      const top = badge.y - 40 * u;
      const cx = W / 2;
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + sx * 150 * u, -10 * u);
        ctx.lineTo(cx + sx * 190 * u, -10 * u);
        ctx.lineTo(cx + sx * 24 * u, top);
        ctx.lineTo(cx - sx * 10 * u, top);
        ctx.closePath();
        ctx.fillStyle = f.pal.accent;
        ctx.fill();
        ctx.restore();
      }
      // the clip
      ctx.fillStyle = "#B9BDC6";
      ctx.beginPath();
      ctx.roundRect(cx - 34 * u, top - 10 * u, 68 * u, 56 * u, 10 * u);
      ctx.fill();
      ctx.strokeStyle = "#8C919C";
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      ctx.arc(cx, badge.y + 4 * u, 22 * u, Math.PI, 0);
      ctx.stroke();
      // the badge
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.22)";
      ctx.shadowBlur = 50 * u;
      ctx.shadowOffsetY = 20 * u;
      ctx.fillStyle = f.pal.paper;
      ctx.beginPath();
      ctx.roundRect(badge.x, badge.y, badge.w, badge.h, 34 * u);
      ctx.fill();
      ctx.restore();
      // the slot for the clip
      ctx.fillStyle = "#D9DAD6";
      ctx.beginPath();
      ctx.roundRect(cx - 60 * u, badge.y + 26 * u, 120 * u, 20 * u, 10 * u);
      ctx.fill();
      // header: the event, the dates
      const hy = badge.y + (L.wide ? 70 : 92) * u;
      text(ctx, f.eventName, badge.x + 44 * u, hy, F.sans(L.wide ? 40 * u : 46 * u, 900), ink, "left");
      text(ctx, f.eventDates, badge.x + badge.w - 44 * u, hy, F.mono(20 * u, 600), grey, "right");
      // who: avatar, name, role
      const look = ROLE_LOOK[j.role] ?? { emoji: "✨", color: C.gold };
      const d = Math.min(130 * u, info.w * 0.32);
      const qs = Math.min(190 * u, info.w * 0.36);
      const nameX = L.wide ? info.x : info.x + d + 26 * u;
      const ay = L.wide ? info.y + d / 2 + 10 * u : info.y + d / 2 + 6 * u;
      const ax = info.x + d / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ECECEA";
      ctx.fill();
      ctx.clip();
      const av = j.avatar;
      if (av.kind === "image") {
        const s = Math.max(d / av.image.width, d / av.image.height);
        ctx.drawImage(av.image, ax - (av.image.width * s) / 2, ay - (av.image.height * s) / 2, av.image.width * s, av.image.height * s);
      } else text(ctx, av.kind === "emoji" ? av.emoji : av.kind === "initials" ? av.text : firstName(j.name).slice(0, 1).toUpperCase(), ax, ay, F.sans(d * 0.42, 800), ink);
      ctx.restore();
      const ny = L.wide ? ay + d / 2 + 50 * u : ay - 14 * u;
      const nameW = L.wide ? info.w : info.w - d - 26 * u - qs - 20 * u;
      ctx.font = F.sans(46 * u, 900);
      const npx = Math.min(46 * u, (46 * u * nameW) / Math.max(1, ctx.measureText(j.name).width));
      text(ctx, j.name, nameX, ny, F.sans(npx, 900), ink, "left");
      if (f.brand) {
        const role = wordOf(f, "lanyard.role") ?? "Guest";
        const org = wordOf(f, "lanyard.org") ?? (f.brand.sponsor ? f.sponsor.name : "");
        if (role) text(ctx, `✨ ${role}`, nameX, ny + 44 * u, F.sans(24 * u, 700), grey, "left");
        if (org) text(ctx, org, nameX, ny + 78 * u, F.mono(20 * u, 600), grey, "left");
      } else {
        text(ctx, `${look.emoji} ${j.role}`, nameX, ny + 44 * u, F.sans(24 * u, 700), look.color === C.gold ? grey : look.color, "left");
        text(ctx, j.handle ?? `Traveller #${j.traveller}`, nameX, ny + 78 * u, F.mono(20 * u, 600), grey, "left");
      }
      // the QR: scan to make your own reel
      const link = f.link ?? `https://${j.siteHost}/reel`;
      const qx = L.wide ? info.x : info.x + info.w - qs;
      const qy = L.wide ? info.y + info.h - qs - 120 * u : info.y;
      drawQr(ctx, link, qx, qy, qs, ink);
      text(ctx, "SCAN · MAKE YOURS", qx + qs / 2, qy + qs + 22 * u, F.mono(14 * u, 700), grey);
      // the foot: pass number, sponsor
      const fy = badge.y + badge.h - 46 * u;
      text(ctx, ticketOf(f), badge.x + 44 * u, fy - 40 * u, F.mono(18 * u, 700), ink, "left");
      poweredBy(ctx, f, badge.x + 44 * u, fy, 20 * u, grey, "left");
      dim(ctx, f, () => text(ctx, signOf(f), badge.x + badge.w - 44 * u, fy, F.mono(16 * u, 500), grey, "right"));
    },
    front(ctx, f) {
      // round the photo's corners (badge-coloured corners over the picture)
      const { R, u } = f;
      const r = 24 * u;
      ctx.save();
      ctx.beginPath();
      ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
      ctx.roundRect(R.x, R.y, R.w, R.h, r);
      ctx.fillStyle = f.pal.paper;
      ctx.fill("evenodd");
      ctx.restore();
    },
  },

  gamecard: {
    label: "🃏 Game card",
    group: "Fun",
    palettes: () => [
      P("Your rarity", "#2B1650", "#FFFFFF", "#B9A8CC", "#0F0A22", "#FFFFFF", "#FFE27A", "#FF7AD9"),
      { ...P("Legendary", "#2B1650", "#FFFFFF", "#B9A8CC", "#0F0A22", "#FFFFFF", "#FFE27A", "#FF7AD9"), rarity: "legendary" as const },
      { ...P("Epic", "#2A1240", "#FFFFFF", "#B9A8CC", "#0E0A1C", "#FFFFFF", "#E9B8FF", "#C77DFF"), rarity: "epic" as const },
      { ...P("Gold", "#2E2208", "#FFFFFF", "#C9B98A", "#120D04", "#FFFFFF", "#F2C94C", "#FFE08A"), rarity: "rare" as const },
      { ...P("Silver", "#1E2530", "#FFFFFF", "#AFC3D6", "#0C1016", "#FFFFFF", "#DDE7F2", "#8DA2B8"), rarity: "uncommon" as const },
    ],
    window: (W, H, u) => gameLayout(W, H, u).R,
    marks: ["tl", "tr"],
    back(ctx, f) {
      const { u, W, H, t } = f;
      const j = f.journey;
      const L = gameLayout(W, H, u);
      const { card, panel } = L;
      const rar = rarFor(f);
      const look = ROLE_LOOK[j.role] ?? { emoji: "✨", color: rar.accent };
      // the table: dark, a glow in the rarity's colour
      fill(ctx, f, "#07060D");
      const glowG = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
      glowG.addColorStop(0, `${rar.foil[0]}38`);
      glowG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowG;
      ctx.fillRect(0, 0, W, H);
      const k = 70 * u;
      // the card body
      ctx.save();
      ctx.shadowColor = `${rar.foil[0]}88`;
      ctx.shadowBlur = 50 * u;
      chamfer(ctx, card, k);
      const body = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + card.h);
      body.addColorStop(0, rar.base[0]);
      body.addColorStop(1, rar.base[1]);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.restore();
      // texture: fine diagonal lines, and a big faint role emblem
      ctx.save();
      chamfer(ctx, card, k);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 2 * u;
      for (let x = card.x - card.h; x < card.x + card.w; x += 18 * u) {
        ctx.beginPath();
        ctx.moveTo(x, card.y + card.h);
        ctx.lineTo(x + card.h, card.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.07;
      text(ctx, look.emoji, panel.x + panel.w / 2, panel.y + panel.h / 2, F.sans(Math.min(panel.w, panel.h) * 0.9, 700), "#FFFFFF");
      ctx.restore();
      // holo foil edge, colours drifting round
      const sweep = ((t * 0.15) % 1) * card.w * 2 - card.w;
      const foil = ctx.createLinearGradient(card.x + sweep, card.y, card.x + sweep + card.w, card.y + card.h);
      rar.foil.forEach((c, i) => foil.addColorStop(i / (rar.foil.length - 1), c));
      ctx.strokeStyle = foil;
      ctx.lineWidth = 14 * u;
      chamfer(ctx, card, k);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2 * u;
      chamfer(ctx, { x: card.x + 16 * u, y: card.y + 16 * u, w: card.w - 32 * u, h: card.h - 32 * u }, k * 0.8);
      ctx.stroke();
      // the photo's foil border
      ctx.strokeStyle = foil;
      ctx.lineWidth = 6 * u;
      ctx.strokeRect(L.R.x - 3 * u, L.R.y - 3 * u, L.R.w + 6 * u, L.R.h + 6 * u);

      // the panel (laid out on a 640 × 250 grid, scaled to fit): only who they are
      const s = Math.min(panel.w / 640, panel.h / 250);
      const ox = panel.x + (panel.w - 640 * s) / 2;
      const oy = panel.y + (panel.h - 250 * s) / 2;
      const X = (v: number) => ox + v * s;
      const Y = (v: number) => oy + v * s;
      const name = j.name.toUpperCase();
      ctx.font = F.display(60 * s, 900);
      const npx = Math.min(60 * s, (60 * s * 600 * s) / Math.max(1, ctx.measureText(name).width));
      text(ctx, name, X(320), Y(40), F.display(npx, 900), "#FFFFFF");
      text(ctx, f.brand ? `${look.emoji} ${(wordOf(f, "gamecard.class") ?? "Party legend").toUpperCase()}` : `${look.emoji} ${j.role.toUpperCase()}${j.handle ? `  ·  ${j.handle}` : ""}`, X(320), Y(86), F.mono(20 * s, 800), look.color);
      ctx.fillStyle = foil;
      ctx.fillRect(X(30), Y(118), 580 * s, 2 * s);
      const ev = ` ${f.eventName.toUpperCase()} `;
      ctx.font = F.mono(17 * s, 800);
      const ew = ctx.measureText(ev).width + 24 * s;
      ctx.fillStyle = rar.base[0];
      ctx.fillRect(X(320) - ew / 2, Y(105), ew, 26 * s);
      text(ctx, ev, X(320), Y(119), F.mono(17 * s, 800), rar.accent);
      // the person, plainly: where from, their pass
      const from = f.brand ? wordOf(f, "gamecard.power") ?? "Special move: the perfect group selfie" : `Flying in from ${j.city} · ${j.km.toLocaleString()} km to Mumbai`;
      ctx.font = F.sans(26 * s, 700);
      const fpx = Math.min(26 * s, (26 * s * 600 * s) / Math.max(1, ctx.measureText(from).width));
      text(ctx, from, X(320), Y(178), F.sans(fpx, 700), "#FFFFFF");
      text(ctx, f.brand ? ticketOf(f) : `Traveller #${j.traveller} · ${j.ticket}`, X(320), Y(222), F.mono(18 * s, 700), rar.accent);
      // sparkles twinkling round the card
      for (let i = 0; i < 9; i++) {
        const px = card.x + (((i * 0.618) % 1) * 0.9 + 0.05) * card.w;
        const py = card.y + (((i * 0.382 + 0.11) % 1) * 0.9 + 0.05) * card.h;
        const tw = Math.sin(t * 2.2 + i * 1.7);
        sparkle(ctx, px, py, (10 + (i % 3) * 6) * u, Math.max(0, tw) * 0.8);
      }
      bands(ctx, f, "#FFFFFF", rar.accent, "rgba(255,255,255,0.6)", card.y, card.y + card.h);
    },
    front(ctx, f) {
      const { t, u } = f;
      chestOpening(ctx, f);
      // a holo shine sweeps across the card every few seconds
      const p = (t % 4) / 1.1;
      if (p > 1 || t < PACK_BURST) return;
      const L = gameLayout(f.W, f.H, u);
      ctx.save();
      chamfer(ctx, L.card, 70 * u);
      ctx.clip();
      const sx = L.card.x - L.card.w * 0.5 + p * L.card.w * 2;
      const g = ctx.createLinearGradient(sx - L.card.w * 0.2, L.card.y, sx + L.card.w * 0.2, L.card.y + L.card.h * 0.35);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.2)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(L.card.x, L.card.y, L.card.w, L.card.h);
      ctx.restore();
    },
  },

  booth: {
    label: "📷 Photo booth",
    group: "Fun",
    palettes: () => [
      P("White strip", "#1A1A1D", "#FFFFFF", "#9A9AA0", "#FAFAF7", "#2A2A2E", "#FF4F7B", "#FF4F7B"),
      P("Black strip", "#EDE7DD", "#141413", "#6B6A66", "#141414", "#F2F2F2", "#D9480F", "#D9480F"),
      P("Red strip", "#2A0E10", "#FFE5E5", "#C99A9A", "#D62839", "#FFFFFF", "#FFC440", "#FFC440"),
      P("Kraft", "#3A2E22", "#F4E7D3", "#BFA88A", "#D9BF94", "#3A2414", "#FFB020", "#FFB020"),
    ],
    window: (W, H, u) => boothLayout(W, H, u).cells[0]!,
    marks: ["tr"],
    back(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const L = boothLayout(W, H, u);
      fill(ctx, f, p.bg);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 40 * u;
      ctx.shadowOffsetY = 12 * u;
      ctx.fillStyle = p.paper;
      ctx.fillRect(L.strip.x, L.strip.y, L.strip.w, L.strip.h);
      ctx.restore();
      // the next photos in the other cells (the reel plays in the first)
      const ph = f.photos ?? [];
      const at = f.seg?.i ?? 0;
      L.cells.slice(1).forEach((c, k) => {
        const img = ph.length > 1 ? ph[(at + 1 + k) % ph.length] : undefined;
        if (img) coverImg(ctx, img, c);
        else {
          ctx.fillStyle = withA(p.ink, 0.12);
          ctx.fillRect(c.x, c.y, c.w, c.h);
        }
      });
      const d = dayOf(f);
      const foot = [firstName(f.journey.name), f.eventName, f.brand && !f.eventDates ? "" : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`].filter(Boolean).join(" · ");
      ctx.font = `italic 700 ${34 * u}px Georgia, serif`;
      const fpx = Math.min(34 * u, (34 * u * (L.foot.w - 40 * u)) / Math.max(1, ctx.measureText(foot).width));
      text(ctx, foot, L.foot.x + L.foot.w / 2, L.foot.y + L.foot.h / 2, `italic 700 ${fpx}px Georgia, serif`, p.ink);
      bands(ctx, f, p.fg, p.accent, p.muted, L.strip.y, L.strip.y + L.strip.h);
    },
  },

  dump: {
    label: "🗂️ Photo dump",
    group: "Fun",
    palettes: () => [
      P("White", "#FAFAF7", "#141413", "#6B6A66", "#EDEDE8", "#141413", "#FF4F7B", "#FF4F7B"),
      P("Black", "#0E0E10", "#FFFFFF", "#8A8A90", "#1C1C20", "#FFFFFF", "#FFC440", "#FFC440"),
      P("Beige", "#EFE6D8", "#3A2E22", "#7A6A55", "#E2D5C0", "#3A2E22", "#C2410C", "#C2410C"),
      P("Lilac", "#ECE6F7", "#2E2440", "#6A5E80", "#DDD3EE", "#2E2440", "#7B4FC9", "#7B4FC9"),
    ],
    window: (W, H, u) => dumpLayout(W, H, u).R,
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const L = dumpLayout(W, H, u);
      fill(ctx, f, p.bg);
      const title = [f.journey.name && `${firstName(f.journey.name)}'s`, f.eventName, "photo dump 📸"].filter(Boolean).join(" ");
      ctx.font = `italic 700 ${48 * u}px Georgia, serif`;
      const tpx = Math.min(48 * u, (48 * u * (W - 100 * u)) / Math.max(1, ctx.measureText(title).width));
      text(ctx, title, isWide(W, H) ? 60 * u : W / 2, L.R.y * 0.62, `italic 700 ${tpx}px Georgia, serif`, p.fg, isWide(W, H) ? "left" : "center");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - 50 * u, L.R.y * 0.25, F.mono(18 * u, 700), p.muted, "right"));
      text(ctx, f.eventDates.toUpperCase(), 50 * u, L.R.y * 0.25, F.mono(18 * u, 700), p.muted, "left");
      // the grid: every photo, the one playing ringed
      const ph = f.photos ?? [];
      const g = L.grid;
      const gap = 14 * u;
      const cell = Math.min((g.w - gap * (L.cols - 1)) / L.cols, (g.h - gap * (L.rows - 1)) / L.rows);
      const slots = L.cols * L.rows;
      const at = f.seg?.i ?? -1;
      const startAt = ph.length > slots ? Math.max(0, Math.min(ph.length - slots, at - 1)) : 0;
      for (let k = 0; k < slots; k++) {
        const c = { x: g.x + (k % L.cols) * (cell + gap), y: g.y + Math.floor(k / L.cols) * (cell + gap), w: cell, h: cell };
        const idx = startAt + k;
        const img = ph[idx];
        ctx.save();
        roundRect(ctx, c, 14 * u);
        ctx.clip();
        if (img) coverImg(ctx, img, c);
        else {
          ctx.fillStyle = p.paper;
          ctx.fillRect(c.x, c.y, c.w, c.h);
        }
        ctx.restore();
        if (img && idx === at) {
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 7 * u;
          roundRect(ctx, c, 14 * u);
          ctx.stroke();
        }
      }
      const fy = H - Math.max(26 * u, (H - (g.y + Math.min(g.h, L.rows * (cell + gap)))) / 2);
      poweredBy(ctx, f, 50 * u, fy, 18 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 50 * u, fy, F.mono(16 * u, 500), p.muted, "right"));
      ctx.save();
      roundRect(ctx, L.R, 22 * u);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();
    },
    front(ctx, f) {
      // round the big photo's corners
      const { R, u } = f;
      ctx.save();
      ctx.beginPath();
      ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
      ctx.roundRect(R.x, R.y, R.w, R.h, 22 * u);
      ctx.fillStyle = f.pal.bg;
      ctx.fill("evenodd");
      ctx.restore();
    },
  },

  story: {
    label: "⏱️ Story",
    group: "Fun",
    palettes: () => [
      P("Sunset ring", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#FEDA75", "#D62976"),
      P("Ocean ring", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#4FACFE", "#00F2FE"),
      P("Lime ring", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#A8FF78", "#22C55E"),
      P("Mono", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#FFFFFF", "#8A8A8A"),
    ],
    window: banded(0, 0, 0),
    marks: [],
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
    },
    front(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const j = f.journey;
      // shades so the bars and buttons read on any photo
      const top = ctx.createLinearGradient(0, 0, 0, 260 * u);
      top.addColorStop(0, "rgba(0,0,0,0.55)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 260 * u);
      const bot = ctx.createLinearGradient(0, H - 260 * u, 0, H);
      bot.addColorStop(0, "rgba(0,0,0,0)");
      bot.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = bot;
      ctx.fillRect(0, H - 260 * u, W, 260 * u);
      // a bar per photo: the done ones full, this one filling
      const n = Math.max(1, f.seg?.n ?? f.photos?.length ?? 5);
      const x0 = 24 * u;
      const gap = 8 * u;
      const bw = (W - x0 * 2 - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const done = f.seg ? (i < f.seg.i ? 1 : i === f.seg.i ? f.seg.p : 0) : f.t > f.total / 2 ? 1 : 0;
        const x = x0 + i * (bw + gap);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        roundRect(ctx, { x, y: 28 * u, w: bw, h: 6 * u }, 3 * u);
        ctx.fill();
        if (done > 0) {
          ctx.fillStyle = "#FFFFFF";
          roundRect(ctx, { x, y: 28 * u, w: bw * done, h: 6 * u }, 3 * u);
          ctx.fill();
        }
      }
      // who posted it: a ringed avatar, the name, the event
      const ay = 100 * u;
      const ax = 70 * u;
      const r = 34 * u;
      const ring = ctx.createLinearGradient(ax - r, ay + r, ax + r, ay - r);
      ring.addColorStop(0, p.accent);
      ring.addColorStop(1, p.accent2);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(ax, ay, r + 6 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.fillStyle = "#222";
      ctx.fill();
      ctx.clip();
      const av = j.avatar;
      if (av.kind === "image") coverImg(ctx, av.image, { x: ax - r, y: ay - r, w: r * 2, h: r * 2 });
      else text(ctx, av.kind === "emoji" ? av.emoji : av.kind === "initials" ? av.text : firstName(j.name).slice(0, 1).toUpperCase(), ax, ay, F.sans(r, 800), "#FFFFFF");
      ctx.restore();
      text(ctx, j.handle ?? firstName(j.name), ax + r + 22 * u, ay - 12 * u, F.sans(28 * u, 800), "#FFFFFF", "left");
      text(ctx, titleAt(f), ax + r + 22 * u, ay + 22 * u, F.sans(22 * u, 600), "rgba(255,255,255,0.8)", "left");
      text(ctx, "⋯   ✕", W - 40 * u, ay, F.sans(34 * u, 700), "#FFFFFF", "right");
      // the reply bar
      const by = H - 80 * u;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.5 * u;
      roundRect(ctx, { x: 30 * u, y: by - 34 * u, w: W - 220 * u, h: 68 * u }, 34 * u);
      ctx.stroke();
      text(ctx, "Send message", 64 * u, by, F.sans(26 * u, 600), "rgba(255,255,255,0.85)", "left");
      text(ctx, "♡   ➤", W - 40 * u, by, F.sans(40 * u, 700), "#FFFFFF", "right");
      dim(ctx, f, () => {
        poweredByNow(ctx, f, 34 * u, by - 70 * u, 18 * u, "rgba(255,255,255,0.8)", "left");
        text(ctx, markOf(f).toUpperCase(), W - 40 * u, by - 70 * u, F.mono(18 * u, 700), "rgba(255,255,255,0.8)", "right");
      });
    },
  },

  comic: {
    label: "💥 Comic",
    group: "Fun",
    palettes: () => [
      P("Yellow", "#FFD23F", "#111111", "#3A3A3A", "#FFF6C9", "#111111", "#FF3B3B", "#E4572E"),
      P("Cyan", "#3EC1F3", "#111111", "#123A52", "#FFFFFF", "#111111", "#FFD23F", "#1B6FA8"),
      P("Pink", "#FF8FC7", "#111111", "#4A1030", "#FFFFFF", "#111111", "#FFE14D", "#C2185B"),
      P("Lime", "#B6F36B", "#111111", "#21401A", "#FFFFFF", "#111111", "#FF6B35", "#2E7D32"),
    ],
    window: (W, H, u) => (isWide(W, H) ? capped(170, 150, 60, 1.8)(W, H, u) : capped(270, 240, 70, 1.5)(W, H, u)),
    tilt: 0.015,
    marks: ["tl"],
    ownsText: true,
    back(ctx, f) {
      const { u, W, H, R } = f;
      const p = f.pal;
      fill(ctx, f, p.bg);
      // halftone dots, bigger towards the bottom right
      ctx.fillStyle = withA(p.accent2, 0.35);
      const step = 30 * u;
      for (let y = 0; y < H + step; y += step)
        for (let x = (Math.floor(y / step) % 2) * (step / 2); x < W + step; x += step) {
          const k = 0.15 + 0.85 * ((x / W + y / H) / 2);
          ctx.beginPath();
          ctx.arc(x, y, step * 0.36 * k, 0, Math.PI * 2);
          ctx.fill();
        }
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - 40 * u, 40 * u, F.mono(20 * u, 800), p.ink, "right"));
      text(ctx, f.eventName.toUpperCase(), 40 * u, 40 * u, F.mono(20 * u, 800), p.ink, "left");
      // the caption box: "Meanwhile, in Mumbai…"
      const cap = (wordOf(f, "comic.caption") ?? (placeOf(f) ? `MEANWHILE, IN ${placeOf(f).toUpperCase()}…` : "MEANWHILE…")).toUpperCase();
      if (cap) {
        ctx.font = `italic 900 ${40 * u}px Inter, system-ui, sans-serif`;
        const cw = Math.min(W - 60 * u, ctx.measureText(cap).width + 50 * u);
        const cy = R.y * 0.6;
        ctx.save();
        ctx.translate(W / 2, cy);
        ctx.rotate(-0.02);
        ctx.fillStyle = p.paper;
        ctx.fillRect(-cw / 2, -36 * u, cw, 72 * u);
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 5 * u;
        ctx.strokeRect(-cw / 2, -36 * u, cw, 72 * u);
        text(ctx, cap, 0, 0, `italic 900 ${40 * u}px Inter, system-ui, sans-serif`, p.ink);
        ctx.restore();
      }
      // the panel's thick border (turned with the picture)
      ctx.save();
      ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
      ctx.rotate(0.015);
      ctx.fillStyle = p.ink;
      ctx.fillRect(-R.w / 2 - 12 * u, -R.h / 2 - 12 * u, R.w + 24 * u, R.h + 24 * u);
      ctx.restore();
      const fy = R.y + R.h + (H - R.y - R.h) * 0.72;
      poweredBy(ctx, f, 40 * u, fy, 20 * u, p.ink, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 40 * u, fy, F.mono(18 * u, 700), p.ink, "right"));
    },
    front(ctx, f) {
      const { u, R, W } = f;
      const p = f.pal;
      // the photo's line in a speech bubble over the panel's lower edge
      const words = f.text.trim();
      if (words) {
        ctx.font = F.sans(38 * u, 900);
        const lines = wrap(ctx, words.toUpperCase(), Math.min(R.w * 0.8, W - 160 * u), 2);
        const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 70 * u;
        const bh = lines.length * 46 * u + 44 * u;
        const bx = R.x + R.w / 2 - bw / 2;
        const by = R.y + R.h - bh * 0.55;
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 5 * u;
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        ctx.moveTo(bx + bw * 0.28, by + 6 * u);
        ctx.lineTo(bx + bw * 0.2, by - 50 * u);
        ctx.lineTo(bx + bw * 0.4, by + 10 * u);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2 - 3 * u, bh / 2 - 3 * u, 0, 0, Math.PI * 2);
        ctx.fill();
        lines.forEach((l, i) => text(ctx, l, bx + bw / 2, by + 22 * u + 23 * u + i * 46 * u, F.sans(38 * u, 900), p.ink));
      }
      // a sound-effect burst pops on each new photo
      if (f.seg) {
        const pop = clamp(f.seg.p / 0.1);
        const sc = pop < 1 ? 0.4 + 0.8 * Math.sin(pop * Math.PI * 0.6) : 1;
        const r = Math.min(150 * u, R.w * 0.2);
        ctx.save();
        ctx.translate(R.x + R.w - r * 0.55, R.y + r * 0.55);
        ctx.rotate(0.12);
        ctx.scale(sc, sc);
        burst(ctx, 0, 0, r, 12, p.accent, p.ink, 5 * u);
        text(ctx, COMIC_WORDS[f.seg.i % COMIC_WORDS.length]!, 0, 0, `italic 900 ${r * 0.42}px Inter, system-ui, sans-serif`, onColor(p.accent));
        ctx.restore();
      }
    },
  },

  neon: {
    label: "🌃 Neon sign",
    group: "Fun",
    palettes: () => [
      P("Pink & blue", "#0B0710", "#FFFFFF", "#8A7F99", "#140D1C", "#FFFFFF", "#FF3EA5", "#3EC5FF"),
      P("Green & yellow", "#07100B", "#FFFFFF", "#7F9988", "#0C1A12", "#FFFFFF", "#39FF88", "#FFE14D"),
      P("Red & white", "#120606", "#FFFFFF", "#997F7F", "#1C0B0B", "#FFFFFF", "#FF3B3B", "#FFFFFF"),
      P("Purple & cyan", "#0A0714", "#FFFFFF", "#8A82A6", "#130E22", "#FFFFFF", "#B26BFF", "#3EF3E0"),
    ],
    window: (W, H, u) => (isWide(W, H) ? capped(190, 150, 80, 1.8)(W, H, u) : capped(300, 260, 90, 1.5)(W, H, u)),
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H, R } = f;
      const p = f.pal;
      fill(ctx, f, p.bg);
      // a brick wall, barely there
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 2 * u;
      const bh = 44 * u;
      const bw = 110 * u;
      for (let y = 0, row = 0; y < H; y += bh, row++) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        for (let x = (row % 2) * (bw / 2); x < W; x += bw) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
          ctx.stroke();
        }
      }
      // the sign's light spilling on the wall
      const spill = ctx.createRadialGradient(W / 2, R.y + R.h / 2, 0, W / 2, R.y + R.h / 2, Math.max(R.w, R.h) * 0.85);
      spill.addColorStop(0, withA(p.accent, 0.22));
      spill.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spill;
      ctx.fillRect(0, 0, W, H);
      const flick = Math.sin(f.t * 17) > 0.96 ? 0.35 : 1;
      const tpx = Math.min(110 * u, R.y * 0.42);
      // the sign: the booth's words, else its place or title (the event's: Mumbai)
      const sign = (wordOf(f, "neon.sign") ?? (f.brand ? placeOf(f) || f.eventName || "SNAP" : "MUMBAI")).toUpperCase();
      if (sign) {
        ctx.font = F.display(tpx, 900);
        const spx = Math.min(tpx, (tpx * (W - 80 * u)) / Math.max(1, ctx.measureText(sign).width));
        glow(ctx, sign, W / 2, R.y * 0.5, F.display(spx, 900), p.accent2, u, flick);
      }
      text(ctx, f.eventName.toUpperCase(), 40 * u, 40 * u, F.mono(18 * u, 700), p.muted, "left");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - 40 * u, 40 * u, F.mono(18 * u, 700), p.muted, "right"));
      const below = R.y + R.h;
      const room = H - below;
      const was = wordOf(f, "neon.below") ?? (f.journey.name ? `${firstName(f.journey.name)} was here` : "We were here");
      if (was) glow(ctx, was, W / 2, below + room * 0.42, `italic 700 ${Math.min(60 * u, room * 0.3)}px Georgia, serif`, p.accent, u);
      poweredBy(ctx, f, 40 * u, H - room * 0.16, 18 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 40 * u, H - room * 0.16, F.mono(16 * u, 500), p.muted, "right"));
    },
    front(ctx, f) {
      // the glowing tube round the picture
      const { u, R } = f;
      ctx.save();
      ctx.strokeStyle = f.pal.accent;
      ctx.shadowColor = f.pal.accent;
      for (const [lw, blur] of [[10, 40], [6, 18], [3, 0]] as const) {
        ctx.lineWidth = lw * u;
        ctx.shadowBlur = blur * u;
        if (!blur) ctx.strokeStyle = mix(f.pal.accent, "#FFFFFF", 0.6);
        roundRect(ctx, { x: R.x - 14 * u, y: R.y - 14 * u, w: R.w + 28 * u, h: R.h + 28 * u }, 26 * u);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // photo prints (./frames-prints): festive, and a plain collage
  "festive-prints": festivePrints,
  "prints-collage": printsCollage,
} satisfies Record<string, FrameDef>;

export type FrameId = keyof typeof DEFS;
export const FRAMES: Record<FrameId, FrameDef> = DEFS;
export const FRAME_IDS = Object.keys(FRAMES) as FrameId[];

/** The frames a booth outside the event offers: all of them (the pass frames print the booth's own route, stamps and badge instead of the pass's). */
export const OPEN_FRAME_IDS: FrameId[] = FRAME_IDS;

/** The frames shown first (the "Top picks" tab, and the start of "All"). */
export const TOP_PICKS: FrameId[] = ["polaroid", "booth", "newspaper", "neon", "magazine", "pass", "postcard", "comic"];
/** These frames, the top picks first. */
export const picksFirst = (ids: FrameId[]): FrameId[] => [...TOP_PICKS.filter((id) => ids.includes(id)), ...ids.filter((id) => !TOP_PICKS.includes(id))];
/** A kind of frame's name on its tab. */
export const groupName = (g: string) => (g === "For devs" ? "Work & tech" : g);

/** A photo's shape: wide (landscape), square, or tall (portrait). */
export type PhotoShape = "wide" | "square" | "tall";
export const shapeOf = (w: number, h: number): PhotoShape => (w / h > 1.2 ? "wide" : w / h < 0.85 ? "tall" : "square");
/** Frames that suit a photo of this shape, best first (each made at the shape's size: wide 16:9, square 1:1, tall its own). */
export const FITS: Record<PhotoShape, FrameId[]> = {
  wide: ["newspaper", "cinema", "pass", "clean", "vhs", "lanyard"],
  square: ["polaroid", "postcard", "scrapbook", "tablet", "clean", "comic", "prints-collage"],
  tall: ["polaroid", "booth", "neon", "magazine", "story", "pass", "comic", "film", "festive-prints", "prints-collage"],
};
