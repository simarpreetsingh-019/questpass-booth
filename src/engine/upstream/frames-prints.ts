/**
 * Photo-print frames: photos as prints on paper. "Festive prints" adds gold
 * line-art hanging diyas and a mandala (Diwali, Lohri, Gurpurab, weddings,
 * community evenings); "Prints collage" is the same without decorations,
 * with up to three prints laid out so each shows. Shared with QuestPass
 * Booth (github.com/simarpreetsingh-019/questpass-booth), which copies this
 * file. Only types come from ./frames, so there's no import cycle.
 */
import { F, text } from "@/features/recap/engine/draw-kit";
import type { FrameCtx, FrameDef, FrameGroup, Palette, Rect } from "./frames";

const CREDIT = "made by @simarpreet_019";

/** `c` (#RRGGBB) at opacity `a`. */
function withA(c: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return c;
  const v = parseInt(m[1]!, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

type Ctx = CanvasRenderingContext2D;
type Font = (px: number) => string;

const P = (name: string, bg: string, fg: string, muted: string, paper: string, ink: string, accent: string, accent2: string): Palette => ({ name, bg, fg, muted, paper, ink, accent, accent2 });
const wide = (W: number, H: number) => W > 1.3 * H;
const TILT = -0.03;

const SERIF: Font = (px) => `italic 700 ${px}px "Playfair Display", Georgia, serif`;
const HAND: Font = (px) => `700 ${px}px Caveat, "Comic Sans MS", cursive`;
const MONO: Font = (px) => F.mono(px, 600);

const word = (f: FrameCtx, id: string, fallback: string) => {
  const w = f.words?.[id];
  return w === undefined ? fallback : w;
};

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

/** The second print, behind the first: below it on tall sizes, beside it on wide ones. */
function backPrint(f: FrameCtx): Rect {
  const { R, u, W, H } = f;
  if (wide(W, H)) return { x: R.x + R.w * 0.5, y: R.y + 70 * u, w: R.w * 0.78, h: R.h * 0.85 };
  return { x: R.x + 46 * u, y: R.y + R.h * 0.62, w: R.w - 30 * u, h: R.h * 0.9 };
}

/** A print: a white-bordered photo with a soft shadow, turned by `rot` around its middle. */
function print(ctx: Ctx, r: Rect, rot: number, u: number, border: string, photo?: CanvasImageSource & { width: number; height: number }) {
  const pad = 16 * u;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 28 * u;
  ctx.shadowOffsetY = 10 * u;
  ctx.fillStyle = border;
  ctx.fillRect(-r.w / 2 - pad, -r.h / 2 - pad, r.w + pad * 2, r.h + pad * 2);
  ctx.shadowColor = "transparent";
  if (photo) {
    ctx.beginPath();
    ctx.rect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.clip();
    const k = Math.max(r.w / photo.width, r.h / photo.height);
    ctx.drawImage(photo, -(photo.width * k) / 2, -(photo.height * k) / 2, photo.width * k, photo.height * k);
  }
  ctx.restore();
}

/** One hanging diya: a chain of links and beads, a little bell, then the lamp with its flame. */
function diya(ctx: Ctx, x: number, top: number, len: number, s: number, gold: string, flame: string) {
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 2.4 * s;
  ctx.lineCap = "round";
  // the chain: little oval links
  const link = 14 * s;
  for (let y = top; y < top + len - link; y += link) {
    ctx.beginPath();
    ctx.ellipse(x, y + link / 2, 3.2 * s, link / 2 - 1 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // a bead and a bell halfway
  const mid = top + len * 0.55;
  ctx.beginPath();
  ctx.arc(x, mid, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, mid + 26 * s);
  ctx.quadraticCurveTo(x - 11 * s, mid + 6 * s, x, mid + 6 * s);
  ctx.quadraticCurveTo(x + 11 * s, mid + 6 * s, x + 12 * s, mid + 26 * s);
  ctx.closePath();
  ctx.stroke();
  // the lamp: three strings down to a shallow bowl
  const y = top + len;
  const bw = 46 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - 30 * s);
  ctx.lineTo(x - bw * 0.8, y);
  ctx.moveTo(x, y - 30 * s);
  ctx.lineTo(x + bw * 0.8, y);
  ctx.moveTo(x, y - 30 * s);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, bw, 8 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - bw, y);
  ctx.quadraticCurveTo(x, y + 46 * s, x + bw, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - bw * 0.35, y + 26 * s);
  ctx.lineTo(x - bw * 0.25, y + 40 * s);
  ctx.lineTo(x + bw * 0.25, y + 40 * s);
  ctx.lineTo(x + bw * 0.35, y + 26 * s);
  ctx.stroke();
  // the flame, with a soft glow
  const g = ctx.createRadialGradient(x, y - 14 * s, 0, x, y - 14 * s, 60 * s);
  g.addColorStop(0, withA(flame, 0.45));
  g.addColorStop(1, withA(flame, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - 60 * s, y - 74 * s, 120 * s, 120 * s);
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(x, y - 30 * s);
  ctx.bezierCurveTo(x + 10 * s, y - 16 * s, x + 9 * s, y - 4 * s, x, y - 2 * s);
  ctx.bezierCurveTo(x - 9 * s, y - 4 * s, x - 10 * s, y - 16 * s, x, y - 30 * s);
  ctx.fill();
  ctx.restore();
}

/** A gold line-art mandala centred at (cx, cy). */
function mandala(ctx: Ctx, cx: number, cy: number, r: number, gold: string, s: number) {
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 2 * s;
  ctx.globalAlpha *= 0.7;
  for (const [k, n, petal] of [[0.22, 8, 0.12], [0.42, 12, 0.14], [0.66, 16, 0.16], [0.9, 24, 0.12]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r * (k + petal * 0.55), cy + Math.sin(a) * r * (k + petal * 0.55));
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * petal * 0.55, r * petal * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a + Math.PI / n) * r * (k + petal), cy + Math.sin(a + Math.PI / n) * r * (k + petal), 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The collage's three prints, laid out so each shows: on tall sizes down a
 * zigzag (left, right, left), on square and wide ones across. Then the box
 * for the words, under the last print shown.
 */
function collageGeo(W: number, H: number, u: number) {
  const k = 0.72; // a print's height to width
  if (W >= H * 0.95 && !wide(W, H)) {
    // square: a cascade from top left to the right, each a little lower
    const w = (W - 120 * u) / 2.05;
    const h = w * k;
    const main = { x: 60 * u, y: 70 * u, w, h };
    const second = { x: main.x + w * 0.6, y: main.y + h * 0.45, w, h };
    const third = { x: main.x + w * 1.2, y: main.y + h * 0.9, w, h };
    const box = (bottom: number) => ({ x: 100 * u, y: bottom + 36 * u, w: W - 200 * u, h: H - bottom - 100 * u });
    return { main, second, third, text2: box(second.y + h), text3: box(third.y + h) };
  }
  if (W >= H * 0.95) {
    // wide: three prints across, the middle one lower
    const w = Math.min((W - 200 * u) / 2.6, (H - 330 * u) / (k * 1.3));
    const h = w * k;
    const x0 = (W - w * 2.6) / 2;
    const main = { x: x0, y: 110 * u, w, h };
    const second = { x: x0 + w * 0.8, y: main.y + h * 0.3, w, h };
    const third = { x: x0 + w * 1.6, y: main.y + h * 0.05, w, h };
    const top = second.y + h + 50 * u;
    const text = { x: 100 * u, y: top, w: W - 200 * u, h: H - top - 70 * u };
    return { main, second, third, text2: text, text3: text };
  }
  // tall: a zigzag down the page
  const w = Math.min(W * 0.72, (H - 360 * u) / (k * 2.6));
  const h = w * k;
  const main = { x: 80 * u, y: (H / W >= 1.5 ? 150 : 90) * u, w, h };
  const second = { x: W - 80 * u - w, y: main.y + h * 0.8, w, h };
  const third = { x: 100 * u, y: second.y + h * 0.8, w, h };
  const box = (top: number) => ({ x: 110 * u, y: top + 40 * u, w: W - 220 * u, h: H - top - 110 * u });
  return { main, second, third, text2: box(second.y + h), text3: box(third.y + h) };
}

interface PrintsOptions {
  id: string;
  label: string;
  group: string;
  /** the hanging diyas and the mandala */
  decorated: boolean;
  palettes: () => Palette[];
}

/** Photo prints on paper: festive (with diyas and a mandala) or a plain collage (up to three prints). */
function printsFrame(o: PrintsOptions): FrameDef {
  const collage = !o.decorated;
  return {
    label: o.label,
    group: o.group as FrameGroup,
    palettes: o.palettes,
    window(W, H, u) {
      if (collage) return collageGeo(W, H, u).main;
      if (wide(W, H)) return { x: 120 * u, y: 150 * u, w: W * 0.5, h: H * 0.56 };
      const t = H / W;
      const w = W - (t >= 1.5 ? 200 : 240) * u;
      const h = t >= 1.5 ? w * (collage ? 0.72 : 0.8) : t >= 1.2 ? w * 0.6 : w * 0.52;
      return { x: (W - w) / 2 - 10 * u, y: (t >= 1.5 ? (collage ? 200 : 250) : t >= 1.2 ? 170 : 120) * u, w, h };
    },
    tilt: TILT,
    ownsText: true,
    marks: ["tl", "tr"],
    back(ctx, f) {
      const { W, H, u, R, pal } = f;
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, W, H);
      // paper grain
      ctx.fillStyle = withA(pal.ink, 0.025);
      for (let i = 0; i < 1600; i++) ctx.fillRect((i * 7919) % W, (i * 104729) % H, 2 * u, 2 * u);
      // the gold mandala, half off the bottom-left corner
      if (o.decorated) mandala(ctx, W * 0.04, H * (wide(W, H) ? 0.92 : 0.9), Math.min(W, H) * 0.34, pal.accent, u);
      const photos = f.photos ?? [];
      if (collage) {
        // the later prints first, so the main one sits on top
        const g = collageGeo(W, H, u);
        if (photos[2]) print(ctx, g.third, -0.02, u, pal.paper, photos[2]);
        print(ctx, g.second, 0.025, u, pal.paper, photos[1] ?? photos[0]);
      } else {
        // the second print, behind the main one
        print(ctx, backPrint(f), 0.012, u, pal.paper, photos[1] ?? photos[0]);
      }
      // the main print's border (the photo itself is drawn into R by the booth)
      print(ctx, R, TILT, u, pal.paper);
    },
    front(ctx, f) {
      const { W, H, u, R, pal } = f;
      const tall = H / W >= 1.5;
      if (o.decorated) {
        // the diyas, hanging over the top-left corner of the prints
        const s = Math.min(W, H) / 1080;
        const lamps: Array<[number, number]> = wide(W, H) ? [[60, 220], [150, 360], [240, 150]] : tall ? [[70, 300], [165, 500], [260, 210]] : [[70, 260], [160, 420], [250, 180]];
        for (const [x, len] of lamps) diya(ctx, x * s, -10 * s, len * s, s, pal.accent, pal.accent2);
      }
      // words: a title, the name and their line, under the lowest print
      const back = backPrint(f);
      const g = collage ? collageGeo(W, H, u) : null;
      const below = g
        ? ((f.photos ?? []).length >= 3 ? g.text3 : g.text2)
        : wide(W, H)
          ? { x: R.x + R.w * 0.62, y: back.y + back.h + 40 * u, w: W - R.x - R.w * 0.62 - 90 * u, h: H - back.y - back.h - 80 * u }
          : { x: 120 * u, y: back.y + back.h + 40 * u, w: W - 240 * u, h: H - back.y - back.h - 90 * u };
      const title = word(f, `${o.id}.title`, f.eventName);
      const name = f.journey.name.trim();
      const line = (f.text ?? "").trim() || word(f, `${o.id}.note`, "");
      const place = [f.brand?.place, f.eventDates].filter(Boolean).join(" · ").toUpperCase();
      const lines: Array<[string, number, Font, string]> = [
        [title, 64, SERIF, pal.fg],
        [name, 62, HAND, pal.ink],
        [line, 44, HAND, withA(pal.ink, 0.85)],
        [place, 22, MONO, pal.accent],
      ].filter(([s]) => s) as Array<[string, number, Font, string]>;
      // bigger words where there's room (the Story size)
      const big = tall ? 1.45 : 1;
      for (const l of lines) l[1] *= big;
      const total = lines.reduce((t, [, px]) => t + px * 1.3 * u, 0);
      const k = below.h > 0 ? Math.min(1, below.h / total) : 0.5;
      let y = below.y + Math.max(0, (below.h - total * k) / 2);
      for (const [s2, px, font, color] of lines) {
        y += px * 0.65 * u * k;
        say(ctx, s2, below.x + below.w / 2, y, below.w, px * u * k, font, color);
        y += px * 0.65 * u * k;
      }
      text(ctx, f.brand?.credit || CREDIT, W - 30 * u, H - 26 * u, F.mono(19 * u, 600), withA(pal.ink, 0.6), "right");
    },
  };
}

export const festivePrints = printsFrame({
  id: "festive-prints",
  label: "🪔 Festive prints",
  group: "Festive",
  decorated: true,
  palettes: () => [
    P("Cream & gold", "#ECE8E1", "#5A3E2B", "#8C7A6B", "#FFFFFF", "#4A3527", "#C9973C", "#E8892B"),
    P("Maroon night", "#3B0E14", "#F6E7C8", "#C9A98A", "#FBF6EC", "#F6E7C8", "#D8A845", "#FF9D3D"),
    P("Ivory & marigold", "#FBF4E4", "#7A2E12", "#A7826A", "#FFFFFF", "#5B2A12", "#D9902A", "#E8642B"),
  ],
});

export const printsCollage = printsFrame({
  id: "prints-collage",
  label: "🖼️ Prints collage",
  group: "Clean",
  decorated: false,
  palettes: () => [
    P("Paper", "#ECE8E1", "#3A3530", "#8C847A", "#FFFFFF", "#3A3530", "#8C7A6B", "#C9973C"),
    P("White", "#F7F7F5", "#222222", "#8A8A8A", "#FFFFFF", "#222222", "#555555", "#999999"),
    P("Black", "#111111", "#F2F2F2", "#9A9A9A", "#FAFAFA", "#F2F2F2", "#BDBDBD", "#888888"),
    P("Kraft", "#C9A27A", "#2E2117", "#6E5440", "#FBF7F0", "#2E2117", "#5A3E2B", "#8C6A4A"),
  ],
});

