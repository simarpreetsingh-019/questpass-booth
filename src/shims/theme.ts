/** Colour helpers the engine imports from QuestPass's @/config/theme. */
import type { SponsorTheme } from "./sponsors";

export type { SponsorTheme } from "./sponsors";

/** "#38FF9C" → "56 255 156" */
export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** "#38FF9C", 0.25 → "rgba(56,255,156,0.25)" */
export function rgba(hex: string, a: number): string {
  return `rgba(${hexToRgb(hex).replace(/ /g, ",")},${a})`;
}

/** Blend hex `a` toward hex `b` by t (0–1), as hex. */
export function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a).split(" ").map(Number);
  const pb = hexToRgb(b).split(" ").map(Number);
  return `#${pa.map((x, i) => Math.round(x + (pb[i]! - x) * t).toString(16).padStart(2, "0")).join("")}`;
}

export const mutedText = (t: SponsorTheme, amount = 0.45) => mix(t.text, t.base, amount);
