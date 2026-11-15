/**
 * Shared drawing kit for the animated GIFs (Mumbai Recap and Journey to
 * Mumbai): one palette, fonts, easing, text helpers, the dark background
 * and the end-card footer (Happy Diwali · powered by <sponsor> · credit).
 *
 * Scenes are laid out on a 480×480 grid (W × H), or a 1080 design grid
 * inside that (`design`), and scaled to the output size by the encoder.
 * Browser-only (canvas, document.fonts).
 */
import { pageSponsor, type SponsorBrand, type SponsorTheme } from "@/config/sponsors";
import { mix, mutedText, rgba } from "@/config/theme";

export { rgba };

/** Logical scene grid; the encoder scales it to the output size. */
export const W = 480;
export const H = 480;
/** Intro and end cards use a finer 1080 grid inside the 480 one. */
export const DESIGN = 1080;
export const FRAME_MS = 80;
export const FPS = 1000 / FRAME_MS;
export const sec = (s: number) => Math.round(s * FPS);

/** Credit line on the last slide. */
// Two spaces around the emoji: canvas measures emoji tight, which eats a single space.
export const CREDIT = { prefix: "made with  ❤️  by ", handle: "@simarpreet_019" };

/* ------------------------------------------------------------------ style */

/**
 * Palette from the site's theme (names are historical: neon = accent, gold =
 * highlight). Every colour a GIF uses comes from here, derived from the
 * theme, so a GIF made on a sponsor's page (or demo preview) wears their
 * colours. Only pure black (shadows) is fixed.
 */
const palette = (T: SponsorTheme) => ({
  bg: T.base,
  panel: T.surface,
  darkGreen: T.accentDark,
  mint: T.accentSoft,
  /** Muted text: the text colour pulled 45% toward the background. */
  grey: mutedText(T),
  /** Map land: the accent mixed deep into the background. */
  land: mix(T.base, T.accent, 0.1),
  neon: T.accent,
  gold: T.highlight,
  marigold: T.highlight2,
  /** Sea on the Mumbai map: the accent, lightened toward the text colour. */
  sea: mix(T.accent, T.text, 0.3),
  shadow: "#000000",
  white: T.text,
  dim: rgba(T.text, 0.6),
  faint: rgba(T.text, 0.22),
});

/** The palette scenes draw with; re-pointed at the page's sponsor before each render (loadFonts). */
export const C = palette(pageSponsor().theme);

/** Use `theme` for the next render (defaults to the current page's sponsor). */
export function applyCanvasTheme(theme: SponsorTheme = pageSponsor().theme) {
  Object.assign(C, palette(theme));
}

export const F = {
  display: (px: number, w = 900) => `${w} ${px}px Cinzel, Georgia, serif`,
  mono: (px: number, w = 500) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`,
  sans: (px: number, w = 600) => `${w} ${px}px Inter, system-ui, sans-serif`,
};

/** Wait for every font the scenes use (a font that fails falls back to the next in its stack). */
export async function loadFonts() {
  // Every render starts here, so this is where the page's theme is picked up.
  applyCanvasTheme();
  await preloadLogoImage(pageSponsor().logoImage);
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    [
      F.display(40), F.display(40, 700),
      F.mono(12, 500), F.mono(12, 600), F.mono(12, 700),
      F.sans(14, 400), F.sans(14, 500), F.sans(14, 600), F.sans(14, 700), F.sans(14, 800),
    ].map((f) => document.fonts.load(f).catch(() => undefined)),
  );
}

/* ---------------------------------------------------------------- helpers */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutBack = (t: number) => {
  const x = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Deterministic PRNG so every render of the same input looks the same. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "center",
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

/** Letter-spaced text (canvas has no reliable letterSpacing everywhere). */
export function spaced(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  spacing: number,
  align: "left" | "center" = "center",
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const chars = [...s];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : x;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i]! + spacing;
  });
}

export function truncate(ctx: CanvasRenderingContext2D, s: string, maxW: number) {
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1);
  return out + "…";
}

/** Fits `s` to `maxW` by shrinking the font, then truncating. Leaves ctx.font set. */
export function fitText(ctx: CanvasRenderingContext2D, s: string, maxW: number, px: number, font: (px: number) => string, minPx: number) {
  let size = px;
  ctx.font = font(size);
  while (size > minPx && ctx.measureText(s).width > maxW) {
    size -= 2;
    ctx.font = font(size);
  }
  return truncate(ctx, s, maxW);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, w: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/* ------------------------------------------------------------- set pieces */

/** The dark background with a gold glow top-centre and a green one bottom-left. */
export function background(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W / 2, -60, 10, W / 2, -60, 380);
  g.addColorStop(0, rgba(C.gold, 0.16));
  g.addColorStop(1, rgba(C.gold, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(40, H + 40, 10, 40, H + 40, 360);
  g.addColorStop(0, rgba(C.neon, 0.14));
  g.addColorStop(1, rgba(C.neon, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Work on a 1080×1080 grid inside `draw`, scaled to the 480 scene grid. */
export function design(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.scale(W / DESIGN, H / DESIGN);
  draw();
  ctx.restore();
}

/* ------------------------------------------------------------ sponsor logo */

const pathCache = new Map<string, { mark: Path2D[]; word: Path2D[] }>();
const imageCache = new Map<string, HTMLImageElement>();

/** Load a raster sponsor logo (previews) before rendering; failures fall back to the name. */
export async function preloadLogoImage(src: string | undefined) {
  if (!src || imageCache.has(src) || typeof Image === "undefined") return;
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    imageCache.set(src, img);
  } catch {
    // unreadable logo: drawSponsorLogo writes the name instead
  }
}

/** The sponsor's logo (vector paths from its config, or an image/name), top-left at (x, y), `height` tall. Returns its width. */
export function drawSponsorLogo(ctx: CanvasRenderingContext2D, sponsor: SponsorBrand, x: number, y: number, height: number): number {
  if (sponsor.logo.mark.length + sponsor.logo.word.length === 0) {
    const img = sponsor.logoImage ? imageCache.get(sponsor.logoImage) : undefined;
    if (img) {
      const w = ((img.naturalWidth || sponsor.logo.width) / (img.naturalHeight || sponsor.logo.height)) * height;
      ctx.drawImage(img, x, y, w, height);
      return w;
    }
    const font = F.sans(Math.round(height * 0.7), 800);
    text(ctx, sponsor.name, x, y + height / 2, font, sponsor.theme.text, "left");
    ctx.font = font;
    return ctx.measureText(sponsor.name).width;
  }
  let p = pathCache.get(sponsor.id);
  if (!p) {
    p = { mark: sponsor.logo.mark.map((d) => new Path2D(d)), word: sponsor.logo.word.map((d) => new Path2D(d)) };
    pathCache.set(sponsor.id, p);
  }
  const k = height / sponsor.logo.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = sponsor.logo.markColor;
  for (const path of p.mark) ctx.fill(path);
  ctx.fillStyle = sponsor.logo.wordColor;
  for (const path of p.word) ctx.fill(path);
  ctx.restore();
  return sponsor.logo.width * k;
}

/* ------------------------------------------------------------ end-card footer */

/** Footer positions on the 1080 grid (below a ticket that ends at ≈ 749). */
export const FOOT = { diwaliY: 868, y: 1012, left: 64, right: 1016 };

/**
 * The end-card footer, inside `design()`: "Happy Diwali" centred above a
 * line with "powered by <sponsor logo>" bottom-left and the credit
 * bottom-right. Each part fades with its own alpha.
 */
export function drawEndFooter(ctx: CanvasRenderingContext2D, alpha: { diwali: number; line: number }) {
  const sponsor = pageSponsor();
  const cx = DESIGN / 2;
  ctx.globalAlpha = alpha.diwali;
  spaced(ctx, "🪔  HAPPY DIWALI  🪔", cx, FOOT.diwaliY, F.sans(34, 700), C.gold, 4);

  ctx.globalAlpha = alpha.line;
  const logoH = 44;
  text(ctx, sponsor.copy.poweredBy, FOOT.left, FOOT.y, F.sans(28, 500), C.grey, "left");
  const pw = ctx.measureText(sponsor.copy.poweredBy).width + 12;
  // the logo's own box has ~5/40 padding top and bottom; nudge to centre
  drawSponsorLogo(ctx, sponsor, FOOT.left + pw, FOOT.y - logoH / 2 - 1, logoH);

  ctx.font = F.sans(28, 700);
  const handleW = ctx.measureText(CREDIT.handle).width;
  const hx = FOOT.right - handleW;
  text(ctx, CREDIT.handle, FOOT.right, FOOT.y, F.sans(28, 700), C.neon, "right");
  text(ctx, CREDIT.prefix, hx, FOOT.y, F.sans(28, 500), C.grey, "right");
  ctx.fillStyle = C.neon;
  ctx.fillRect(hx, FOOT.y + 19, handleW, 2);
  ctx.globalAlpha = 1;
}
