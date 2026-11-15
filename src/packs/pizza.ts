/**
 * The pizza pack: six frames for pizza parties (made for PizzaDAO's Global
 * Pizza Party, 22 May, Bitcoin Pizza Day). A booth shows them when its
 * config has `packs: ["pizza"]`.
 *
 * Each frame is an ordinary FrameDef (the same shape as the built-in
 * frames), so this file is also the example for anyone adding their own:
 * registerFrame(id, def, meta), plus registerWordSlot for text people or
 * the organisers can change. Every frame prints the person's whole name and
 * their line (the photo's caption) under the photo.
 */
import { drawSponsorLogo, F, text } from "../engine/upstream/draw-kit";
import { mix, sponsorLogo, withA, type FrameCtx, type FrameDef, type FrameGroup, type Palette, type Rect } from "../engine/upstream/frames";
import { roundRect } from "../engine/upstream/reel";
import { registerWordSlot, type WordMode } from "../core/config";
import { registerFrame } from "../core/frames-meta";
import { CREDIT_LINE } from "../core/credit";

type Ctx = CanvasRenderingContext2D;
type Font = (px: number) => string;

export const PIZZA_PACK = "pizza";
const GROUP = "Pizza" as FrameGroup;

/* ------------------------------------------------------------- helpers */

const P = (name: string, bg: string, fg: string, muted: string, paper: string, ink: string, accent: string, accent2: string): Palette => ({ name, bg, fg, muted, paper, ink, accent, accent2 });
const wide = (W: number, H: number) => W > 1.3 * H;
const tallness = (W: number, H: number) => H / W;

const BEBAS: Font = (px) => `400 ${px}px "Bebas Neue", Impact, "Arial Narrow", sans-serif`;
const MONO: Font = (px) => F.mono(px, 700);
const MONO_LIGHT: Font = (px) => F.mono(px, 500);
const SERIF_I: Font = (px) => `italic 600 ${px}px Georgia, "Times New Roman", serif`;
const HAND: Font = (px) => `700 ${px}px Caveat, "Comic Sans MS", cursive`;
const CINZEL: Font = (px) => `900 ${px}px Cinzel, Georgia, serif`;
const SANS: Font = (px) => F.sans(px, 700);

/** A text space's words: undefined → the frame's default, "" → off. */
const word = (f: FrameCtx, id: string, fallback: string) => {
  const w = f.words?.[id];
  return w === undefined ? fallback : w;
};
const nameOf = (f: FrameCtx) => f.journey.name.trim();
const lineOf = (f: FrameCtx) => (f.text ?? "").trim();
const placeDate = (f: FrameCtx) => [f.brand?.place, f.eventDates].filter(Boolean).join(" · ");

/** Text shrunk to fit `maxW` (down to half its size), then cut with an ellipsis. */
function say(ctx: Ctx, s: string, x: number, y: number, maxW: number, px: number, font: Font, color: string, align: CanvasTextAlign = "center") {
  if (!s) return;
  let size = px;
  ctx.font = font(size);
  while (size > px * 0.5 && ctx.measureText(s).width > maxW) {
    size *= 0.94;
    ctx.font = font(size);
  }
  let out = s;
  while (out.length > 1 && ctx.measureText(out).width > maxW) out = out.slice(0, -2) + "…";
  text(ctx, out, x, y, font(size), color, align);
}

interface Line {
  s: string;
  px: number;
  font: Font;
  color: string;
  /** extra space after it */
  gap?: number;
}

/** Lines stacked in a box, centred vertically, shrunk together if they don't fit. */
function stack(ctx: Ctx, lines: Line[], box: Rect, align: "center" | "left" = "center") {
  const shown = lines.filter((l) => l.s);
  const total = shown.reduce((t, l) => t + l.px * 1.22 + (l.gap ?? 0), 0);
  if (!total || box.h <= 0) return;
  const k = Math.min(1, box.h / total);
  let y = box.y + (box.h - total * k) / 2;
  for (const l of shown) {
    const px = l.px * k;
    y += px * 0.61;
    say(ctx, l.s, align === "center" ? box.x + box.w / 2 : box.x, y, box.w, px, l.font, l.color, align);
    y += px * 0.61 + (l.gap ?? 0) * k;
  }
}

/** The brand's logo, centred on x, `h` tall (only when the booth shows its brand). Returns the height used. */
function logo(ctx: Ctx, f: FrameCtx, cx: number, y: number, h: number): number {
  if (!f.brand?.sponsor) return 0;
  const probe = document.createElement("canvas").getContext("2d");
  const w = probe ? drawSponsorLogo(probe, f.sponsor, 0, 0, h) : 0;
  if (w <= 0) return 0;
  sponsorLogo(ctx, f.sponsor, cx - w / 2, y, h);
  return h;
}

/** The credit, small, bottom right (on every frame; see CREDIT_LINE). */
function credit(ctx: Ctx, f: FrameCtx, color: string) {
  ctx.save();
  ctx.globalAlpha = Math.max(ctx.globalAlpha, 0.85);
  text(ctx, f.brand?.credit || CREDIT_LINE, f.W - 28 * f.u, f.H - 26 * f.u, MONO(20 * f.u), color, "right");
  ctx.restore();
}

/** The photo's border: a mat of `pad` around the window. */
function mat(ctx: Ctx, R: Rect, pad: number, fill: string, stroke?: string, line = 0) {
  ctx.fillStyle = fill;
  ctx.fillRect(R.x - pad, R.y - pad, R.w + pad * 2, R.h + pad * 2);
  if (stroke && line) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.strokeRect(R.x - pad + line / 2, R.y - pad + line / 2, R.w + pad * 2 - line, R.h + pad * 2 - line);
  }
}

/** A repeatable pseudo-random number from a seed (same picture every time). */
function seeded(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/* ------------------------------------------------------------ pizza box */

const boxBands = (W: number, H: number) => {
  const t = tallness(W, H);
  return t >= 1.5 ? [470, 430] : t >= 1.2 ? [330, 320] : [250, 240];
};

const pizzaBox: FrameDef = {
  label: "🍕 Pizza box",
  group: GROUP,
  palettes: () => [
    P("Kraft", "#C9965B", "#B3261E", "#7A5530", "#F4E6CC", "#3B2412", "#D7262B", "#1E7B34"),
    P("White box", "#EFE9DD", "#C8262B", "#8C8478", "#FFFFFF", "#2A2622", "#C8262B", "#1E7B34"),
    P("Black box", "#151515", "#FFD23D", "#8A8A8A", "#222222", "#FEFDFA", "#FF393A", "#FFD23D"),
  ],
  window(W, H, u) {
    if (wide(W, H)) return { x: 120 * u, y: 110 * u, w: W * 0.56 - 120 * u, h: H - 220 * u };
    const [top, bottom] = boxBands(W, H);
    return { x: 120 * u, y: top! * u, w: W - 240 * u, h: H - (top! + bottom!) * u };
  },
  ownsText: true,
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // corrugated board: faint lines
    ctx.fillStyle = withA(pal.ink, 0.035);
    for (let y = 0; y < H; y += 14 * u) ctx.fillRect(0, y, W, 3 * u);
    // the lid's folded edges
    ctx.strokeStyle = withA(pal.ink, 0.25);
    ctx.lineWidth = 6 * u;
    const e = 28 * u;
    ctx.strokeRect(e, e, W - 2 * e, H - 2 * e);
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[e, e, 1, 1], [W - e, e, -1, 1], [e, H - e, 1, -1], [W - e, H - e, -1, -1]] as const) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 70 * u, y + dy * 70 * u);
    }
    ctx.stroke();
    // a couple of grease spots (it's a real box)
    for (const [x, y, r] of [[W * 0.84, H * 0.1, 130 * u], [W * 0.12, H * 0.92, 95 * u]] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, withA(mix(pal.bg, "#000000", 0.5), 0.22));
      g.addColorStop(1, withA(pal.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // printed photo panel
    mat(ctx, R, 16 * u, pal.paper, pal.fg, 6 * u);

    // the lid's print: a round "HOT & FRESH" seal and the title
    const top = wide(W, H) ? { x: R.x + R.w + 60 * u, y: 90 * u, w: W - R.x - R.w - 150 * u, h: H * 0.45 } : { x: 120 * u, y: 40 * u, w: W - 240 * u, h: R.y - 70 * u };
    const r = Math.min(95 * u, top.h * 0.28);
    const cx = top.x + top.w / 2;
    const cy = top.y + r + top.h * 0.04;
    ctx.fillStyle = pal.fg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    const seal = word(f, "pizza-box.top", "HOT & FRESH").toUpperCase();
    const parts = seal.includes(" & ") ? [seal.split(" & ")[0]!, `& ${seal.split(" & ")[1]}`] : [seal];
    parts.forEach((p, i) => say(ctx, p, cx, cy + (i - (parts.length - 1) / 2) * r * 0.5, r * 1.4, r * 0.48, BEBAS, pal.paper));
    say(ctx, f.eventName.toUpperCase(), cx, cy + r + (top.h - 2 * r) * 0.5, top.w, Math.min(120 * u, top.h * 0.36), BEBAS, pal.fg);
    if (!wide(W, H)) text(ctx, "THIS SIDE UP ↑", 52 * u, 70 * u, MONO_LIGHT(18 * u), withA(pal.ink, 0.45), "left");
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const box = wide(W, H) ? { x: R.x + R.w + 60 * u, y: H * 0.52, w: W - R.x - R.w - 150 * u, h: H * 0.4 } : { x: 120 * u, y: R.y + R.h + 36 * u, w: W - 240 * u, h: H - (R.y + R.h) - 130 * u };
    stack(ctx, [
      { s: word(f, "pizza-box.to", "DELIVERED TO").toUpperCase(), px: 26 * u, font: MONO, color: withA(pal.ink, 0.6), gap: 6 * u },
      { s: nameOf(f), px: 96 * u, font: BEBAS, color: pal.ink },
      { s: lineOf(f) && `“${lineOf(f)}”`, px: 36 * u, font: SERIF_I, color: pal.ink, gap: 10 * u },
      { s: placeDate(f).toUpperCase(), px: 24 * u, font: MONO, color: pal.fg },
    ], box);
    logo(ctx, f, wide(W, H) ? box.x + box.w / 2 : W / 2, H - 92 * u, 44 * u);
    credit(ctx, f, withA(pal.ink, 0.5));
  },
};

/* -------------------------------------------- Bitcoin Pizza Day receipt */

const receiptBands = (W: number, H: number) => (tallness(W, H) >= 1.5 ? { head: 250, items: 620 } : { head: 190, items: 480 });

function receiptWindow(W: number, H: number, u: number): Rect {
  if (tallness(W, H) < 1.2) {
    const paperW = Math.min(W * 0.4, 640 * u);
    return { x: 80 * u, y: 80 * u, w: W - paperW - 80 * u - 140 * u, h: H - 160 * u };
  }
  const { head, items } = receiptBands(W, H);
  const paperW = Math.min(W - 200 * u, 820 * u);
  const w = paperW - 110 * u;
  const h = Math.max(260 * u, Math.min(w * 1.15, H - 140 * u - (head + items) * u));
  const y0 = (H - (head * u + h + items * u)) / 2;
  return { x: (W - w) / 2, y: y0 + head * u, w, h };
}

/** The paper: a rectangle with a torn (zigzag) top and bottom. */
function receiptPaper(ctx: Ctx, x: number, y0: number, w: number, y1: number, u: number, fill: string) {
  const tooth = 18 * u;
  ctx.beginPath();
  ctx.moveTo(x, y0 + tooth);
  for (let i = 0, n = Math.ceil(w / (tooth * 2)); i < n; i++) {
    ctx.lineTo(Math.min(x + w, x + i * tooth * 2 + tooth), y0);
    ctx.lineTo(Math.min(x + w, x + (i + 1) * tooth * 2), y0 + tooth);
  }
  ctx.lineTo(x + w, y1 - tooth);
  for (let i = Math.ceil(w / (tooth * 2)); i > 0; i--) {
    ctx.lineTo(Math.max(x, x + i * tooth * 2 - tooth), y1);
    ctx.lineTo(Math.max(x, x + (i - 1) * tooth * 2), y1 - tooth);
  }
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 10 * u;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function dashed(ctx: Ctx, x0: number, x1: number, y: number, u: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * u;
  ctx.setLineDash([10 * u, 8 * u]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.restore();
}

/** The receipt's lines, from the top of `box` down. */
function receiptBody(ctx: Ctx, f: FrameCtx, box: Rect, withHeader: boolean) {
  const { u, pal } = f;
  const L = box.x;
  const Rx = box.x + box.w;
  const item = (y: number, a: string, b: string, px: number, bold = false) => {
    const font = bold ? MONO : MONO_LIGHT;
    text(ctx, b, Rx, y, font(px), pal.ink, "right");
    ctx.font = font(px);
    say(ctx, a, L, y, box.w - ctx.measureText(b).width - 24 * u, px, font, pal.ink, "left");
  };
  // rows in units of height; scaled to the box
  const rows = (withHeader ? 3.2 : 0) + 11.2;
  const k = box.h / rows;
  const px = Math.min(28 * u, k * 0.62);
  let y = box.y;
  if (withHeader) {
    const used = logo(ctx, f, L + box.w / 2, y + k * 0.1, Math.min(54 * u, k * 1.1));
    say(ctx, f.eventName.toUpperCase(), L + box.w / 2, y + (used ? k * 1.75 : k * 0.9), box.w, px * 1.25, MONO, pal.ink);
    say(ctx, placeDate(f).toUpperCase(), L + box.w / 2, y + (used ? k * 2.6 : k * 1.9), box.w, px * 0.85, MONO_LIGHT, withA(pal.ink, 0.7));
    y += k * 3.2;
  }
  dashed(ctx, L, Rx, y + k * 0.3, u, withA(pal.ink, 0.5));
  item(y + k * 1.1, word(f, "pizza-receipt.item1", "2 × LARGE PIZZA"), word(f, "pizza-receipt.price1", "10,000 BTC"), px);
  item(y + k * 2.0, word(f, "pizza-receipt.item2", "NEW FRENS"), word(f, "pizza-receipt.price2", "PRICELESS"), px);
  dashed(ctx, L, Rx, y + k * 2.7, u, withA(pal.ink, 0.5));
  item(y + k * 3.5, "TOTAL", word(f, "pizza-receipt.price1", "10,000 BTC"), px * 1.25, true);
  say(ctx, word(f, "pizza-receipt.paid", "PAID IN BITCOIN · 22.05.2010"), L + box.w / 2, y + k * 4.5, box.w, px * 0.8, MONO, pal.accent);
  dashed(ctx, L, Rx, y + k * 5.2, u, withA(pal.ink, 0.5));
  say(ctx, nameOf(f) ? `SERVED TO: ${nameOf(f).toUpperCase()}` : "SERVED HOT", L + box.w / 2, y + k * 6.1, box.w, px * 1.1, MONO, pal.ink);
  if (lineOf(f)) say(ctx, `“${lineOf(f)}”`, L + box.w / 2, y + k * 7.0, box.w, px * 1.05, SERIF_I, pal.ink);
  // barcode
  const rnd = seeded(hash(nameOf(f) + f.eventName));
  const bw = Math.min(box.w * 0.8, 520 * u);
  let bx = L + (box.w - bw) / 2;
  const by = y + k * 7.8;
  ctx.fillStyle = pal.ink;
  while (bx < L + (box.w + bw) / 2) {
    const w = (1 + Math.floor(rnd() * 3)) * 2.4 * u;
    if (rnd() > 0.35) ctx.fillRect(bx, by, w, k * 1.5);
    bx += w + 2.4 * u;
  }
  say(ctx, word(f, "pizza-receipt.footer", "THANK YOU · PIZZA THE PLANET"), L + box.w / 2, y + k * 10.1, box.w, px * 0.85, MONO, pal.ink);
}

const pizzaReceipt: FrameDef = {
  label: "🧾 Bitcoin Pizza receipt",
  group: GROUP,
  palettes: () => [
    P("Bitcoin orange", "#F7931A", "#1A1A1A", "#6B6B6B", "#FBFAF5", "#1A1A1A", "#D7262B", "#F7931A"),
    P("Night", "#121212", "#FEFDFA", "#8A8A8A", "#FBFAF5", "#1A1A1A", "#D7262B", "#F7931A"),
    P("Pizza red", "#B3261E", "#FEFDFA", "#F3B9B4", "#FBFAF5", "#1A1A1A", "#B3261E", "#F7931A"),
  ],
  window: receiptWindow,
  ownsText: true,
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // a faint ₿ pattern on the table
    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let y = 60 * u, row = 0; y < H; y += 150 * u, row++) for (let x = (row % 2) * 75 * u; x < W; x += 150 * u) text(ctx, "₿", x, y, F.sans(48 * u, 800), pal.fg);
    ctx.restore();
    if (tallness(W, H) < 1.2) {
      // the photo on the table, the receipt beside it
      mat(ctx, R, 14 * u, "#FFFFFF");
      const x = R.x + R.w + 60 * u;
      const w = W - x - 80 * u;
      receiptPaper(ctx, x, 50 * u, w, H - 50 * u, u, pal.paper);
      receiptBody(ctx, f, { x: x + 40 * u, y: 100 * u, w: w - 80 * u, h: H - 200 * u }, true);
      return;
    }
    const { head, items } = receiptBands(W, H);
    const x = R.x - 55 * u;
    const w = R.w + 110 * u;
    const y0 = R.y - head * u;
    const y1 = R.y + R.h + items * u;
    receiptPaper(ctx, x, y0, w, y1, u, pal.paper);
    // header above the photo
    const hb = { x: x + 55 * u, y: y0 + 40 * u, w: w - 110 * u, h: head * u - 60 * u };
    const used = logo(ctx, f, x + w / 2, hb.y, Math.min(56 * u, hb.h * 0.36));
    stack(ctx, [
      { s: f.eventName.toUpperCase(), px: 36 * u, font: MONO, color: pal.ink },
      { s: placeDate(f).toUpperCase(), px: 22 * u, font: MONO_LIGHT, color: withA(pal.ink, 0.7) },
    ], { ...hb, y: hb.y + (used ? used + 10 * u : 0), h: hb.h - (used ? used + 10 * u : 0) });
    receiptBody(ctx, f, { x: x + 55 * u, y: R.y + R.h + 20 * u, w: w - 110 * u, h: items * u - 60 * u }, false);
  },
  front(ctx, f) {
    credit(ctx, f, withA(f.pal.fg, 0.6));
  },
};

/* --------------------------------------------------- Pizza Mafia poster */

const POSTER = 0.72;
function poster(W: number, H: number, u: number): Rect {
  const h = Math.min(H - 70 * u, (W - 70 * u) / POSTER);
  const w = h * POSTER;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

const pizzaMafia: FrameDef = {
  label: "🕴️ Pizza Mafia wanted",
  group: GROUP,
  palettes: () => [
    P("Old paper", "#2A1A10", "#E9D9B4", "#8B6B4A", "#EAD9B0", "#2B1A0E", "#B3261E", "#2B1A0E"),
    P("Night", "#0B0B10", "#FEFDFA", "#8A8A8A", "#EFE6D2", "#151515", "#FF393A", "#151515"),
    P("Red wall", "#7A1712", "#FEFDFA", "#E8B4AE", "#F1E4C8", "#2B1A0E", "#B3261E", "#2B1A0E"),
  ],
  window(W, H, u) {
    const p = poster(W, H, u);
    const w = p.w * 0.78;
    return { x: p.x + (p.w - w) / 2, y: p.y + p.h * 0.215, w, h: p.h * 0.42 };
  },
  ownsText: true,
  marks: [],
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // wood grain
    const rnd = seeded(11);
    ctx.strokeStyle = withA(mix(pal.bg, "#000000", 0.5), 0.35);
    ctx.lineWidth = 2 * u;
    for (let i = 0; i < 40; i++) {
      const y = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 40 * u, W * 0.7, y + (rnd() - 0.5) * 40 * u, W, y + (rnd() - 0.5) * 30 * u);
      ctx.stroke();
    }
    const p = poster(W, H, u);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40 * u;
    ctx.shadowOffsetY = 14 * u;
    ctx.fillStyle = pal.paper;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
    // aged edges
    const g = ctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.35, p.x + p.w / 2, p.y + p.h / 2, p.h * 0.75);
    g.addColorStop(0, withA(pal.paper, 0));
    g.addColorStop(1, withA(mix(pal.paper, "#5A3A1A", 0.6), 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // nails
    for (const x of [p.x + 26 * u, p.x + p.w - 26 * u]) {
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(x, p.y + 26 * u, 8 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    const cx = p.x + p.w / 2;
    const inner = p.w * 0.86;
    say(ctx, word(f, "pizza-mafia.title", "WANTED").toUpperCase(), cx, p.y + p.h * 0.1, inner, p.h * 0.11, CINZEL, pal.ink);
    say(ctx, `BY THE ${(f.eventName || "PIZZA MAFIA").toUpperCase()}`, cx, p.y + p.h * 0.185, inner, p.h * 0.026, MONO, pal.accent);
    mat(ctx, R, 10 * u, pal.ink);
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const p = poster(W, H, u);
    const cx = p.x + p.w / 2;
    const inner = p.w * 0.86;
    stack(ctx, [
      { s: nameOf(f).toUpperCase() || "THE DON", px: p.h * 0.075, font: BEBAS, color: pal.ink },
      { s: lineOf(f) && `a.k.a. “${lineOf(f)}”`, px: p.h * 0.03, font: SERIF_I, color: pal.ink, gap: p.h * 0.012 },
      { s: word(f, "pizza-mafia.crime", "FOR STEALING THE LAST SLICE").toUpperCase(), px: p.h * 0.026, font: MONO, color: pal.ink },
      { s: word(f, "pizza-mafia.reward", "REWARD: ONE LARGE PEPPERONI").toUpperCase(), px: p.h * 0.032, font: BEBAS, color: pal.accent },
    ], { x: cx - inner / 2, y: R.y + R.h + p.h * 0.02, w: inner, h: p.y + p.h * 0.9 - (R.y + R.h) });
    const pd = placeDate(f).toUpperCase();
    const used = logo(ctx, f, cx, p.y + p.h - p.h * 0.075, p.h * 0.035);
    if (!used && pd) say(ctx, pd, cx, p.y + p.h - p.h * 0.05, inner, p.h * 0.022, MONO, withA(pal.ink, 0.7));
    // the red rubber stamp, over the photo's corner
    const stamp = word(f, "pizza-mafia.stamp", "PIZZA MAFIA").toUpperCase();
    if (stamp) {
      const r = Math.min(R.w, R.h) * 0.2;
      ctx.save();
      ctx.translate(R.x + R.w - r * 0.7, R.y + R.h - r * 0.55);
      ctx.rotate(-0.26);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      say(ctx, stamp, 0, -r * 0.12, r * 1.4, r * 0.32, BEBAS, pal.accent);
      say(ctx, "MEMBER", 0, r * 0.3, r * 1.2, r * 0.2, MONO, pal.accent);
      ctx.restore();
    }
    credit(ctx, f, withA(pal.fg, 0.6));
  },
};

/* ---------------------------------------------------------- whole pizza */

function pizzaGeo(W: number, H: number, u: number) {
  if (wide(W, H)) {
    const s = H * 0.8;
    return { s, cx: W * 0.36, cy: H / 2 };
  }
  const t = tallness(W, H);
  const s = t >= 1.5 ? Math.min(W * 0.86, H * 0.55) : t >= 1.2 ? Math.min(W * 0.74, H * 0.6) : H * 0.62;
  return { s, cx: W / 2, cy: t >= 1.5 ? H * 0.46 : H * 0.48 };
  void u;
}

function board(ctx: Ctx, f: FrameCtx) {
  const { W, H, u, pal } = f;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(5);
  ctx.strokeStyle = withA(mix(pal.bg, "#000000", 0.6), 0.22);
  ctx.lineWidth = 2.2 * u;
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rnd() - 0.5) * 60 * u, H * 0.3, x + (rnd() - 0.5) * 60 * u, H * 0.7, x + (rnd() - 0.5) * 40 * u, H);
    ctx.stroke();
  }
}

const pizzaWhole: FrameDef = {
  label: "🍕 Whole pizza",
  group: GROUP,
  palettes: () => [
    P("Wood board", "#6B4226", "#FEFDFA", "#E8C9A0", "#F3E2C3", "#2A1A10", "#C7362D", "#3E7B2E"),
    P("Pizza red", "#B3261E", "#FEFDFA", "#F3B9B4", "#F3E2C3", "#2A1A10", "#FFD23D", "#3E7B2E"),
    P("Night", "#0B0B10", "#FEFDFA", "#8A8A8A", "#F3E2C3", "#2A1A10", "#FF393A", "#3E7B2E"),
  ],
  window(W, H, u) {
    const { s, cx, cy } = pizzaGeo(W, H, u);
    return { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
  },
  ownsText: true,
  marks: [],
  back(ctx, f) {
    board(ctx, f);
    const { R } = f;
    const g = ctx.createRadialGradient(R.x + R.w / 2, R.y + R.h / 2 + R.h * 0.04, R.w * 0.4, R.x + R.w / 2, R.y + R.h / 2 + R.h * 0.04, R.w * 0.6);
    g.addColorStop(0, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(R.x - R.w * 0.2, R.y - R.h * 0.2, R.w * 1.4, R.h * 1.5);
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const cx = R.x + R.w / 2;
    const cy = R.y + R.h / 2;
    const rOut = R.w / 2;
    const crust = R.w * 0.075;
    const rIn = rOut - crust;
    // everything outside the pizza back to the board
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
    ctx.clip("evenodd");
    board(ctx, f);
    ctx.restore();
    // the crust
    const g = ctx.createRadialGradient(cx, cy, rIn, cx, cy, rOut);
    g.addColorStop(0, "#C9853F");
    g.addColorStop(0.45, "#E2AE62");
    g.addColorStop(1, "#A8642A");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
    ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    const rnd = seeded(23);
    ctx.fillStyle = "rgba(70,35,10,0.35)";
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rIn + crust * (0.25 + rnd() * 0.5);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, crust * 0.12, crust * 0.07, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // sauce at the edge
    ctx.strokeStyle = "rgba(179,38,30,0.85)";
    ctx.lineWidth = R.w * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cy, rIn - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    // toppings around the edge (never in the middle, where the faces are)
    const at = (deg: number, k = 0.06) => [cx + Math.cos((deg * Math.PI) / 180) * (rIn - R.w * k), cy + Math.sin((deg * Math.PI) / 180) * (rIn - R.w * k)] as const;
    for (const deg of [18, 78, 142, 205, 262, 322]) {
      const [x, y] = at(deg);
      const r = R.w * 0.038;
      ctx.fillStyle = "#A3241C";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(90,15,10,0.6)";
      for (const [dx, dy] of [[-0.35, -0.2], [0.3, 0.1], [-0.05, 0.4]] as const) {
        ctx.beginPath();
        ctx.arc(x + dx * r, y + dy * r, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const deg of [48, 172, 292]) {
      const [x, y] = at(deg, 0.05);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.fillStyle = "#2F7A2A";
      ctx.beginPath();
      ctx.ellipse(0, 0, R.w * 0.036, R.w * 0.018, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = R.w * 0.003;
      ctx.beginPath();
      ctx.moveTo(-R.w * 0.03, 0);
      ctx.lineTo(R.w * 0.03, 0);
      ctx.stroke();
      ctx.restore();
    }
    for (const deg of [108, 236, 350]) {
      const [x, y] = at(deg, 0.045);
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = R.w * 0.009;
      ctx.beginPath();
      ctx.arc(x, y, R.w * 0.014, 0, Math.PI * 2);
      ctx.stroke();
    }
    // words
    if (wide(W, H)) {
      const box = { x: R.x + R.w + 70 * u, y: 90 * u, w: W - R.x - R.w - 150 * u, h: H - 180 * u };
      stack(ctx, [
        { s: f.eventName.toUpperCase(), px: 96 * u, font: BEBAS, color: pal.fg, gap: 20 * u },
        { s: nameOf(f), px: 80 * u, font: BEBAS, color: pal.accent },
        { s: lineOf(f) && `“${lineOf(f)}”`, px: 38 * u, font: SERIF_I, color: pal.fg, gap: 14 * u },
        { s: placeDate(f).toUpperCase(), px: 26 * u, font: MONO, color: withA(pal.fg, 0.8) },
      ], box);
      logo(ctx, f, box.x + box.w / 2, H - 110 * u, 46 * u);
    } else {
      say(ctx, f.eventName.toUpperCase(), W / 2, R.y / 2 + 10 * u, W - 160 * u, Math.min(110 * u, R.y * 0.5), BEBAS, pal.fg);
      const used = logo(ctx, f, W / 2, H - 100 * u, 44 * u);
      stack(ctx, [
        { s: nameOf(f), px: 88 * u, font: BEBAS, color: pal.fg },
        { s: lineOf(f) && `“${lineOf(f)}”`, px: 36 * u, font: SERIF_I, color: pal.fg, gap: 10 * u },
        { s: placeDate(f).toUpperCase(), px: 24 * u, font: MONO, color: withA(pal.fg, 0.8) },
      ], { x: 100 * u, y: R.y + R.h + 24 * u, w: W - 200 * u, h: H - (R.y + R.h) - 40 * u - (used ? 120 * u : 30 * u) });
    }
    credit(ctx, f, withA(pal.fg, 0.55));
  },
};

/* ------------------------------------------- pizzeria table (gingham) */

const tableBands = (W: number, H: number) => (tallness(W, H) >= 1.5 ? [250, 560] : tallness(W, H) >= 1.2 ? [210, 430] : [170, 330]);

function gingham(ctx: Ctx, f: FrameCtx) {
  const { W, H, u, pal } = f;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  const step = 108 * u;
  ctx.fillStyle = withA(pal.accent, 0.5);
  for (let x = 0; x < W; x += step) ctx.fillRect(x, 0, step / 2, H);
  for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, step / 2);
}

function chalkboard(ctx: Ctx, f: FrameCtx, b: Rect) {
  const { u, pal } = f;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24 * u;
  ctx.shadowOffsetY = 8 * u;
  ctx.fillStyle = pal.accent2;
  roundRect(ctx, b, 14 * u);
  ctx.fill();
  ctx.restore();
  const inner = { x: b.x + 16 * u, y: b.y + 16 * u, w: b.w - 32 * u, h: b.h - 32 * u };
  ctx.fillStyle = pal.paper;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  // chalk dust
  const rnd = seeded(3);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 260; i++) ctx.fillRect(inner.x + rnd() * inner.w, inner.y + rnd() * inner.h, 3 * u, 3 * u);
  stack(ctx, [
    { s: word(f, "pizza-table.special", "TODAY'S SPECIAL"), px: 46 * u, font: HAND, color: withA(pal.ink, 0.85), gap: 4 * u },
    { s: nameOf(f) || "You", px: 104 * u, font: HAND, color: pal.ink },
    { s: lineOf(f), px: 46 * u, font: HAND, color: withA(pal.ink, 0.9), gap: 8 * u },
    { s: placeDate(f).toUpperCase(), px: 22 * u, font: MONO, color: withA(pal.ink, 0.7) },
  ], { x: inner.x + 30 * u, y: inner.y + 14 * u, w: inner.w - 60 * u, h: inner.h - 28 * u });
}

const pizzaTable: FrameDef = {
  label: "🍷 Pizzeria table",
  group: GROUP,
  palettes: () => [
    P("Red check", "#FFFFFF", "#C8262B", "#8C8478", "#1F2A24", "#F2F2EA", "#C8262B", "#7A4A26"),
    P("Blue check", "#FFFFFF", "#2457A6", "#8C8478", "#1F2A24", "#F2F2EA", "#2457A6", "#7A4A26"),
    P("Green check", "#FFFFFF", "#2E7D32", "#8C8478", "#1F2A24", "#F2F2EA", "#2E7D32", "#7A4A26"),
  ],
  window(W, H, u) {
    if (wide(W, H)) return { x: 110 * u, y: 150 * u, w: W * 0.56 - 110 * u, h: H - 260 * u };
    const [top, bottom] = tableBands(W, H);
    return { x: 130 * u, y: top! * u, w: W - 260 * u, h: H - (top! + bottom!) * u };
  },
  ownsText: true,
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    gingham(ctx, f);
    // the title on a white label
    const top = wide(W, H) ? { x: R.x, y: 30 * u, w: R.w, h: R.y - 50 * u } : { x: 100 * u, y: 40 * u, w: W - 200 * u, h: R.y - 80 * u };
    ctx.font = BEBAS(Math.min(90 * u, top.h * 0.62));
    const tw = Math.min(top.w, ctx.measureText(f.eventName.toUpperCase()).width + 80 * u);
    const label = { x: top.x + (top.w - tw) / 2, y: top.y + top.h * 0.12, w: tw, h: top.h * 0.76 };
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 16 * u;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, label, 16 * u);
    ctx.fill();
    ctx.restore();
    say(ctx, f.eventName.toUpperCase(), label.x + label.w / 2, label.y + label.h / 2 + 4 * u, label.w - 40 * u, Math.min(90 * u, top.h * 0.6), BEBAS, pal.fg);
    // the photo in a wooden frame
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 26 * u;
    ctx.shadowOffsetY = 10 * u;
    mat(ctx, R, 22 * u, pal.accent2);
    ctx.restore();
    mat(ctx, R, 6 * u, "#F6EBD9");
  },
  front(ctx, f) {
    const { W, H, u, R } = f;
    if (wide(W, H)) {
      const x = R.x + R.w + 70 * u;
      chalkboard(ctx, f, { x, y: 120 * u, w: W - x - 90 * u, h: H - 240 * u });
      logo(ctx, f, x + (W - x - 90 * u) / 2, H - 100 * u, 40 * u);
    } else {
      const y = R.y + R.h + 50 * u;
      const room = H - y - 50 * u;
      const lh = room > 330 * u ? 50 * u : 0;
      chalkboard(ctx, f, { x: 90 * u, y, w: W - 180 * u, h: room - lh - (lh ? 16 * u : 0) });
      if (lh) logo(ctx, f, W / 2, H - 50 * u - lh + 4 * u, 40 * u);
    }
    credit(ctx, f, "rgba(0,0,0,0.55)");
  },
};

/* ------------------------------------------------- Rare Pizza NFT card */

const RARITIES: Array<{ name: string; color: string; weight: number }> = [
  { name: "Common", color: "#9CA3AF", weight: 34 },
  { name: "Uncommon", color: "#34D399", weight: 26 },
  { name: "Rare", color: "#60A5FA", weight: 18 },
  { name: "Super Rare", color: "#A78BFA", weight: 11 },
  { name: "Epic", color: "#F472B6", weight: 7 },
  { name: "Grail", color: "#FBBF24", weight: 4 },
];
const TRAITS: Array<[string, string[]]> = [
  ["Crust", ["Thin", "Deep dish", "Stuffed", "Neapolitan", "Sourdough", "Pan", "Detroit", "Cauliflower"]],
  ["Sauce", ["Marinara", "Pesto", "White", "BBQ", "Vodka", "Hot honey", "Arrabbiata", "Garlic"]],
  ["Cheese", ["Mozzarella", "Burrata", "Gorgonzola", "Four cheese", "Parmesan", "Ricotta", "Vegan", "Smoked"]],
  ["Topping", ["Pepperoni", "Pineapple", "Mushroom", "Basil", "Jalapeño", "Black olive", "Anchovy", "Truffle", "Hot salami", "Rocket"]],
];

/** The card's numbers for a name: always the same for the same name (and booth). */
function nftOf(f: FrameCtx) {
  const seed = hash(`${nameOf(f).toLowerCase()}|${f.eventName}`);
  const rnd = seeded(seed);
  const number = 1 + Math.floor(rnd() * 10000);
  const typed = word(f, "pizza-nft.rarity", "").trim().toLowerCase();
  let rarity = RARITIES.find((r) => r.name.toLowerCase() === typed);
  if (!rarity) {
    let roll = rnd() * 100;
    rarity = RARITIES.find((r) => (roll -= r.weight) < 0) ?? RARITIES[0]!;
  }
  const traits = TRAITS.map(([k, list]) => [k, list[Math.floor(rnd() * list.length)]!] as const);
  return { number, rarity, traits };
}

function nftCard(W: number, H: number, u: number) {
  if (wide(W, H)) {
    const h = H - 120 * u;
    return { x: 80 * u, y: 60 * u, w: W - 160 * u, h };
  }
  const t = tallness(W, H);
  const w = t >= 1.5 ? W - 140 * u : t >= 1.2 ? Math.min(W - 140 * u, (H - 100 * u) * 0.66) : (H - 80 * u) * 0.7;
  const h = t >= 1.5 ? Math.min(H - 220 * u, w * 1.62) : H - (t >= 1.2 ? 100 : 80) * u;
  return { x: (W - w) / 2, y: (H - h) / 2 + (t >= 1.5 ? 30 * u : 0), w, h };
}

function stars(ctx: Ctx, f: FrameCtx) {
  const { W, H, u, pal } = f;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.7);
  g.addColorStop(0, withA(pal.accent2, 0.18));
  g.addColorStop(1, withA(pal.bg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(77);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = withA("#FFFFFF", 0.25 + rnd() * 0.6);
    const r = (0.8 + rnd() * 2.2) * u;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few twinkles
  ctx.strokeStyle = withA(pal.accent, 0.8);
  ctx.lineWidth = 3 * u;
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = (8 + rnd() * 10) * u;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
  }
}

const pizzaNft: FrameDef = {
  label: "🃏 Rare Pizza card",
  group: GROUP,
  palettes: () => [
    P("Night sky", "#070B1A", "#FEFDFA", "#9AA4BF", "#121A33", "#FEFDFA", "#FFD23D", "#7B5CFF"),
    P("Pizza red", "#3A0A08", "#FEFDFA", "#E8B4AE", "#1C0D0B", "#FEFDFA", "#FFD23D", "#FF393A"),
    P("Grail gold", "#141008", "#FFF6DC", "#C9B98A", "#211A0C", "#FFF6DC", "#FBBF24", "#FF8A28"),
  ],
  window(W, H, u) {
    const c = nftCard(W, H, u);
    if (wide(W, H)) {
      const s = c.h - 80 * u;
      return { x: c.x + 40 * u, y: c.y + 40 * u, w: s, h: s };
    }
    const w = c.w - 60 * u;
    return { x: c.x + 30 * u, y: c.y + c.h * 0.075, w, h: Math.min(w, c.h * 0.52) };
  },
  ownsText: true,
  marks: [],
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    stars(ctx, f);
    const c = nftCard(W, H, u);
    const { rarity } = nftOf(f);
    // the card, edged in its rarity's colour
    ctx.save();
    ctx.shadowColor = withA(rarity.color, 0.55);
    ctx.shadowBlur = 50 * u;
    ctx.fillStyle = pal.paper;
    roundRect(ctx, c, 28 * u);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rarity.color;
    ctx.lineWidth = 5 * u;
    roundRect(ctx, { x: c.x + 2.5 * u, y: c.y + 2.5 * u, w: c.w - 5 * u, h: c.h - 5 * u }, 26 * u);
    ctx.stroke();
    // a board under the photo (a pizza on a peel)
    ctx.fillStyle = "#6B4226";
    roundRect(ctx, { x: R.x - 8 * u, y: R.y - 8 * u, w: R.w + 16 * u, h: R.h + 16 * u }, 14 * u);
    ctx.fill();
    // header: collection and edition
    const top = wide(W, H) ? { x: R.x + R.w + 50 * u, y: c.y + 40 * u, w: c.x + c.w - (R.x + R.w) - 90 * u } : { x: c.x + 30 * u, y: c.y + 14 * u, w: c.w - 60 * u };
    const hy = wide(W, H) ? top.y + 26 * u : (c.y + R.y) / 2 + 2 * u;
    const hp = wide(W, H) ? 28 * u : Math.min(28 * u, (R.y - c.y) * 0.42);
    say(ctx, word(f, "pizza-nft.collection", "RARE PIZZA").toUpperCase(), top.x, hy, top.w * 0.6, hp, MONO, pal.accent, "left");
    text(ctx, "1 OF 1", top.x + top.w, hy, MONO(hp * 0.85), withA(pal.ink, 0.6), "right");
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const c = nftCard(W, H, u);
    const { number, rarity, traits } = nftOf(f);
    const box = wide(W, H) ? { x: R.x + R.w + 50 * u, y: c.y + 90 * u, w: c.x + c.w - (R.x + R.w) - 90 * u, h: c.h - 130 * u } : { x: c.x + 30 * u, y: R.y + R.h + 22 * u, w: c.w - 60 * u, h: c.y + c.h - (R.y + R.h) - 44 * u };
    // rows, in units of the box's height
    const units = 8.6;
    const k = box.h / units;
    const px = Math.min(30 * u, k * 0.5);
    let y = box.y;
    // name and number
    const title = `${nameOf(f) || "Unnamed Pizza"} #${number}`;
    say(ctx, title, box.x, y + k * 0.62, box.w, Math.min(64 * u, k * 1.05), BEBAS, pal.ink, "left");
    y += k * 1.35;
    // rarity badge
    ctx.font = MONO(px * 0.95);
    const bw = ctx.measureText(rarity.name.toUpperCase()).width + px * 1.6;
    ctx.fillStyle = withA(rarity.color, 0.18);
    roundRect(ctx, { x: box.x, y: y, w: bw, h: k * 0.85 }, k * 0.42);
    ctx.fill();
    ctx.strokeStyle = rarity.color;
    ctx.lineWidth = 2.5 * u;
    ctx.stroke();
    text(ctx, rarity.name.toUpperCase(), box.x + bw / 2, y + k * 0.44, MONO(px * 0.95), rarity.color);
    if (lineOf(f)) say(ctx, `“${lineOf(f)}”`, box.x + bw + px, y + k * 0.44, box.w - bw - px, px * 1.05, SERIF_I, withA(pal.ink, 0.85), "left");
    y += k * 1.25;
    // traits, two by two, like an NFT's properties
    const cw = (box.w - 14 * u) / 2;
    traits.forEach(([key, value], i) => {
      const x = box.x + (i % 2) * (cw + 14 * u);
      const ty = y + Math.floor(i / 2) * k * 1.55;
      ctx.fillStyle = withA(pal.accent2, 0.16);
      roundRect(ctx, { x, y: ty, w: cw, h: k * 1.35 }, 12 * u);
      ctx.fill();
      text(ctx, key.toUpperCase(), x + cw / 2, ty + k * 0.38, MONO(px * 0.7), withA(pal.ink, 0.6));
      say(ctx, value, x + cw / 2, ty + k * 0.92, cw - 16 * u, px * 1.05, SANS, pal.ink);
    });
    y += k * 3.2;
    // minted at, and the brand
    const minted = ["MINTED AT", f.eventName, placeDate(f)].filter(Boolean).join(" · ").toUpperCase();
    say(ctx, minted, box.x, y + k * 0.45, box.w * (f.brand?.sponsor ? 0.68 : 1), px * 0.72, MONO, withA(pal.ink, 0.7), "left");
    if (f.brand?.sponsor) {
      const probe = document.createElement("canvas").getContext("2d");
      const lh = Math.min(40 * u, k * 0.8);
      const lw = probe ? drawSponsorLogo(probe, f.sponsor, 0, 0, lh) : 0;
      if (lw > 0) sponsorLogo(ctx, f.sponsor, box.x + box.w - lw, y + k * 0.45 - lh / 2, lh);
    }
    credit(ctx, f, withA(pal.fg, 0.5));
  },
};

/* ------------------------------------------------------------- the pack */

const SLOTS: Array<{ id: string; frame: string; label: string; max: number; placeholder: string; defaultMode: WordMode }> = [
  { id: "pizza-box.top", frame: "pizza-box", label: "Seal", max: 20, placeholder: "HOT & FRESH", defaultMode: "fixed" },
  { id: "pizza-box.to", frame: "pizza-box", label: "Above the name", max: 20, placeholder: "DELIVERED TO", defaultMode: "fixed" },
  { id: "pizza-receipt.item1", frame: "pizza-receipt", label: "First item", max: 22, placeholder: "2 × LARGE PIZZA", defaultMode: "fixed" },
  { id: "pizza-receipt.price1", frame: "pizza-receipt", label: "Its price (and the total)", max: 12, placeholder: "10,000 BTC", defaultMode: "fixed" },
  { id: "pizza-receipt.item2", frame: "pizza-receipt", label: "Second item", max: 22, placeholder: "NEW FRENS", defaultMode: "edit" },
  { id: "pizza-receipt.price2", frame: "pizza-receipt", label: "Its price", max: 12, placeholder: "PRICELESS", defaultMode: "edit" },
  { id: "pizza-receipt.paid", frame: "pizza-receipt", label: "Paid line", max: 32, placeholder: "PAID IN BITCOIN · 22.05.2010", defaultMode: "fixed" },
  { id: "pizza-receipt.footer", frame: "pizza-receipt", label: "Bottom line", max: 32, placeholder: "THANK YOU · PIZZA THE PLANET", defaultMode: "fixed" },
  { id: "pizza-mafia.title", frame: "pizza-mafia", label: "Headline", max: 12, placeholder: "WANTED", defaultMode: "fixed" },
  { id: "pizza-mafia.crime", frame: "pizza-mafia", label: "The crime", max: 32, placeholder: "FOR STEALING THE LAST SLICE", defaultMode: "edit" },
  { id: "pizza-mafia.reward", frame: "pizza-mafia", label: "Reward", max: 32, placeholder: "REWARD: ONE LARGE PEPPERONI", defaultMode: "edit" },
  { id: "pizza-mafia.stamp", frame: "pizza-mafia", label: "Stamp", max: 14, placeholder: "PIZZA MAFIA", defaultMode: "fixed" },
  { id: "pizza-table.special", frame: "pizza-table", label: "Chalkboard heading", max: 24, placeholder: "TODAY'S SPECIAL", defaultMode: "fixed" },
  { id: "pizza-nft.collection", frame: "pizza-nft", label: "Collection name", max: 20, placeholder: "RARE PIZZA", defaultMode: "fixed" },
  { id: "pizza-nft.rarity", frame: "pizza-nft", label: "Rarity (Common … Grail; empty: picked from the name)", max: 10, placeholder: "picked from the name", defaultMode: "fixed" },
];

let done = false;

/** Add the pizza frames (done once, when the booth loads). */
export function registerPizzaPack() {
  if (done) return;
  done = true;
  const meta = { pack: PIZZA_PACK, group: "Pizza", tracks: ["happy", "dhol", "house"], ownColors: true };
  registerFrame("pizza-box", pizzaBox, { ...meta, best: "Group shots, the whole party", ratio: "9:16", intro: "takeoff" });
  registerFrame("pizza-receipt", pizzaReceipt, { ...meta, best: "Bitcoin Pizza Day, the origin story", ratio: "9:16", intro: "chime" });
  registerFrame("pizza-mafia", pizzaMafia, { ...meta, best: "Your mafia name, solo shots", ratio: "4:5", intro: "projector", tracks: ["trap", "drill", "dhol"] });
  registerFrame("pizza-whole", pizzaWhole, { ...meta, best: "Faces up close, food shots", ratio: "9:16", intro: "vinyl" });
  registerFrame("pizza-nft", pizzaNft, { ...meta, best: "Your own 1-of-1 Rare Pizza", ratio: "9:16", intro: "projector", tracks: ["trap", "synth", "happy"] });
  registerFrame("pizza-table", pizzaTable, { ...meta, best: "Friends at the table", ratio: "9:16", intro: "vinyl", tracks: ["chai", "sunset", "happy"] });
  for (const s of SLOTS) registerWordSlot(s);
}

// the frames exist as soon as the booth loads; a booth shows them only with packs: ["pizza"]
registerPizzaPack();
