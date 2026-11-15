/** Colour helpers the engine imports from QuestPass's @/config/theme. */
import type { SponsorTheme } from "./sponsors";
export type { SponsorTheme } from "./sponsors";
/** "#38FF9C" → "56 255 156" */
export declare function hexToRgb(hex: string): string;
/** "#38FF9C", 0.25 → "rgba(56,255,156,0.25)" */
export declare function rgba(hex: string, a: number): string;
/** Blend hex `a` toward hex `b` by t (0–1), as hex. */
export declare function mix(a: string, b: string, t: number): string;
export declare const mutedText: (t: SponsorTheme, amount?: number) => string;
