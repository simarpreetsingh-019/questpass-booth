/**
 * Shared drawing kit for the animated GIFs (Mumbai Recap and Journey to
 * Mumbai): one palette, fonts, easing, text helpers, the dark background
 * and the end-card footer (Happy Diwali · powered by <sponsor> · credit).
 *
 * Scenes are laid out on a 480×480 grid (W × H), or a 1080 design grid
 * inside that (`design`), and scaled to the output size by the encoder.
 * Browser-only (canvas, document.fonts).
 */
import { type SponsorBrand, type SponsorTheme } from "../../shims/sponsors";
import { rgba } from "../../shims/theme";
export { rgba };
/** Logical scene grid; the encoder scales it to the output size. */
export declare const W = 480;
export declare const H = 480;
/** Intro and end cards use a finer 1080 grid inside the 480 one. */
export declare const DESIGN = 1080;
export declare const FRAME_MS = 80;
export declare const FPS: number;
export declare const sec: (s: number) => number;
/** Credit line on the last slide. */
export declare const CREDIT: {
    prefix: string;
    handle: string;
};
/** The palette scenes draw with; re-pointed at the page's sponsor before each render (loadFonts). */
export declare const C: {
    bg: string;
    panel: string;
    darkGreen: string;
    mint: string;
    /** Muted text: the text colour pulled 45% toward the background. */
    grey: string;
    /** Map land: the accent mixed deep into the background. */
    land: string;
    neon: string;
    gold: string;
    marigold: string;
    /** Sea on the Mumbai map: the accent, lightened toward the text colour. */
    sea: string;
    shadow: string;
    white: string;
    dim: string;
    faint: string;
};
/** Use `theme` for the next render (defaults to the current page's sponsor). */
export declare function applyCanvasTheme(theme?: SponsorTheme): void;
export declare const F: {
    display: (px: number, w?: number) => string;
    mono: (px: number, w?: number) => string;
    sans: (px: number, w?: number) => string;
};
/** Wait for every font the scenes use (a font that fails falls back to the next in its stack). */
export declare function loadFonts(): Promise<void>;
export declare const clamp: (v: number, lo?: number, hi?: number) => number;
export declare const easeOut: (t: number) => number;
export declare const easeInOut: (t: number) => number;
export declare const easeOutBack: (t: number) => number;
/** Deterministic PRNG so every render of the same input looks the same. */
export declare function rng(seed: number): () => number;
export declare function hashSeed(s: string): number;
export declare function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align?: CanvasTextAlign): void;
/** Letter-spaced text (canvas has no reliable letterSpacing everywhere). */
export declare function spaced(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, spacing: number, align?: "left" | "center"): void;
export declare function truncate(ctx: CanvasRenderingContext2D, s: string, maxW: number): string;
/** Fits `s` to `maxW` by shrinking the font, then truncating. Leaves ctx.font set. */
export declare function fitText(ctx: CanvasRenderingContext2D, s: string, maxW: number, px: number, font: (px: number) => string, minPx: number): string;
export declare function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void;
export declare function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, w: number): void;
/** The dark background with a gold glow top-centre and a green one bottom-left. */
export declare function background(ctx: CanvasRenderingContext2D): void;
/** Work on a 1080×1080 grid inside `draw`, scaled to the 480 scene grid. */
export declare function design(ctx: CanvasRenderingContext2D, draw: () => void): void;
/** Load a raster sponsor logo (previews) before rendering; failures fall back to the name. */
export declare function preloadLogoImage(src: string | undefined): Promise<void>;
/** The sponsor's logo (vector paths from its config, or an image/name), top-left at (x, y), `height` tall. Returns its width. */
export declare function drawSponsorLogo(ctx: CanvasRenderingContext2D, sponsor: SponsorBrand, x: number, y: number, height: number): number;
/** Footer positions on the 1080 grid (below a ticket that ends at ≈ 749). */
export declare const FOOT: {
    diwaliY: number;
    y: number;
    left: number;
    right: number;
};
/**
 * The end-card footer, inside `design()`: "Happy Diwali" centred above a
 * line with "powered by <sponsor logo>" bottom-left and the credit
 * bottom-right. Each part fades with its own alpha.
 */
export declare function drawEndFooter(ctx: CanvasRenderingContext2D, alpha: {
    diwali: number;
    line: number;
}): void;
