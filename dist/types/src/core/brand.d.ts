/**
 * A BoothConfig as the engine takes it: the brand as the frames' "sponsor"
 * (logo, colours), the booth's own wording (FrameBrand), the video's
 * closing card (OpenReel) and the person (their name only).
 */
import { type SponsorBrand, type SponsorTheme } from "../shims/sponsors";
import type { JourneyInput } from "../shims/journey";
import type { FrameBrand } from "../engine/upstream/frames";
import type { OpenReel } from "../engine/upstream/reel";
import { type BoothColors, type BoothConfig } from "./config";
export declare const CREDIT_LINE = "made with QuestPass";
/** The engine's full theme from the booth's four colours. */
export declare function themeOf(c: BoothColors): SponsorTheme;
export declare function sponsorOf(c: BoothConfig, logo: string): SponsorBrand;
export declare function frameBrandOf(c: BoothConfig, logo: string): FrameBrand;
export declare function openReelOf(c: BoothConfig): OpenReel;
/** The person on the frames and the video: just their name, typed in the booth (nothing else is asked). */
export declare function personOf(name: string, c: BoothConfig): JourneyInput;
/**
 * The logo as a data URL the canvas can read: an https logo is fetched once
 * (it must allow CORS, or it is left off: a picture from another site that
 * doesn't allow it would block saving the photo).
 */
export declare function logoData(src: string): Promise<string>;
/** Everything the engine needs for this config, ready to draw with (fonts, logo, active brand). */
export declare function prepare(c: BoothConfig): Promise<{
    logo: string;
    sponsor: SponsorBrand;
    brand: FrameBrand;
    open: OpenReel;
}>;
/**
 * Colours for a booth from its logo: the logo's strongest colour becomes the
 * accent, the next distinct one the highlight; a dark backdrop with light
 * text. Null when the logo has no real colour in it (black and white):
 * keep the colours you have then. Runs on the device.
 */
export declare function colorsFromImage(img: CanvasImageSource): BoothColors | null;
