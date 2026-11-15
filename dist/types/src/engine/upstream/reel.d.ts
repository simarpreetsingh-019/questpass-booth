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
import type { SponsorBrand } from "../../shims/sponsors";
import { type JourneyInput } from "../../shims/journey";
import { type IntroSound, type Track } from "./music";
import { type FrameBrand, type FrameId, type Palette, type Rect } from "./frames";
export type Ratio = "9:16" | "4:5" | "1:1" | "16:9";
export declare const RATIOS: Record<Ratio, [number, number]>;
export declare const INTRO_SEC = 6;
/**
 * the closing card: the photos zoom out to a wall, "My … recap, made with
 * QuestPass", the picture closes. Extra time on top of the 40 s / 90 s limit.
 */
export declare const OUTRO_SEC = 5;
export declare const MAX_SEC = 40;
/** the "keep it longer" choice (X takes up to 140 s; Reels and Shorts up to 90 s and 60 s+) */
export declare const LONG_SEC = 90;
export declare const MAX_ITEMS = 20;
export declare const TEXT_MAX = 60;
export declare const CAPTION_MAX = 50;
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
    focus: {
        x: number;
        y: number;
    };
    /** the day it was taken, YYYY-MM-DD (from the photo's EXIF, or set by hand); shown as a date stamp */
    date?: string;
    /** ⚡ a quick one: on screen for half its usual time */
    fast?: boolean;
    /** set by hand: how long it stays, in steps (quarter beats of the track), whatever the timing; unset follows the timing */
    hold?: number;
    /** how its text looks and where it sits (default: bold white on a dark box, near the bottom) */
    style?: CaptionStyle;
}
export type CaptionFont = "bold" | "hand" | "marker" | "serif" | "poster" | "type";
export type CaptionColor = "white" | "accent" | "gold" | "marigold" | "pink" | "ink";
export interface CaptionStyle {
    font: CaptionFont;
    color: CaptionColor;
    /** the text's centre, 0–1 across and down the video (kept inside it) */
    pos?: {
        x: number;
        y: number;
    };
}
/** The fonts: name, CSS family (for the picker), the canvas font, and a size factor so they look alike in size. */
export declare const CAPTION_FONTS: Record<CaptionFont, {
    label: string;
    css: string;
    font: (px: number) => string;
    k: number;
}>;
/** Colours that sit with the site's theme (read when drawn, so they follow it). */
export declare const CAPTION_COLORS: Record<CaptionColor, () => string>;
export declare const DEFAULT_CAPTION: CaptionStyle;
export declare function loadCaptionFonts(): Promise<void>;
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
/**
 * When each photo plays (seconds from the start), the photos' end (where the
 * closing card starts) and the total length. With a window `aspect`, two
 * crosswise photos in a row share the screen side by side.
 */
/** The time one step (a quarter beat) of the track takes: photo lengths are whole steps, so cuts land on the music. */
export declare const stepSec: (track: Track) => number;
/** How many steps photo `i` stays: set by hand, else by the timing (⚡ halves it). */
export declare function photoSteps(input: Pick<ContentInput, "items" | "track" | "timing">, i: number): number;
export declare function planReel(input: Pick<ContentInput, "items" | "track" | "timing">, aspect?: number): {
    segments: Segment[];
    total: number;
    photosEnd: number;
};
/** A collectible touch per role: its emoji and colour on the name card and the closing card. */
export declare const ROLE_LOOK: Record<string, {
    emoji: string;
    color: string;
}>;
export declare function roundRect(ctx: CanvasRenderingContext2D, r: Rect, rad: number): void;
/** Wrap `s` to at most `lines` lines of `maxW` (font already set). */
export declare function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number, lines?: number): string[];
export declare const firstName: (n: string) => string;
/** Whether a photo shows whole (on its blurred self) in a window of this shape. */
export declare function showsWhole(item: Pick<ReelItem, "fit" | "image">, aspect: number): boolean;
export interface ContentRenderer {
    total: number;
    /** where the closing card starts */
    photosEnd: number;
    /** when the picture changes (each photo, and the closing card), for the cut sound and the timeline */
    cuts: number[];
    /** the date of the photo showing at t, for frames that print it themselves */
    dateAt(t: number): string | undefined;
    /** while a photo shows: which (of how many) and how far through it, for frames that count them */
    segAt(t: number): {
        i: number;
        n: number;
        p: number;
    } | undefined;
    size: [number, number];
    /** The text the current moment carries (a photo's text, or the intro's headline), for frames that show it themselves. */
    textAt(t: number): string;
    /** Draw the content at time t into (0,0)–size; `labels: false` leaves photo text to the frame, `dates: false` the date stamp. */
    draw(ctx: CanvasRenderingContext2D, t: number, labels?: boolean, dates?: boolean): void;
}
/** The reel at `size` (the frame window's shape, any aspect). */
export declare function makeContent(input: ContentInput, size: [number, number]): Promise<ContentRenderer>;
export interface Composer {
    size: [number, number];
    total: number;
    cuts: number[];
    draw(ctx: CanvasRenderingContext2D, t: number): void;
}
type FrameOpts = Pick<ReelInput, "ratio" | "frame" | "sponsor" | "eventName" | "eventDates" | "journey" | "stats" | "link" | "note" | "palette" | "brand" | "words"> & Partial<Pick<ReelInput, "items">>;
/** The frame's colours for these options: the palette given, or the frame's numbered (default first) one. */
export declare function framePalette(frame: FrameId, palette?: number | Palette): Palette;
/** The window the reel fills for this frame and ratio. */
export declare function reelWindow(opts: Pick<ReelInput, "ratio" | "frame">): Rect;
/** Make the content at the frame's window shape and wrap it in the frame. */
export declare function buildReel(input: ReelInput): Promise<Composer>;
/** Wrap a content layer (made at reelWindow's size) in its frame. */
export declare function composeReel(content: ContentRenderer, opts: FrameOpts): Composer;
/** The name slide (frame 0) as an image: the cover for platforms that let you pick one. */
export declare function renderCover(input: ReelInput): Promise<Blob>;
/**
 * A still of a frame around one photo, for the template picker: no intro,
 * no music, just the frame's back, the photo in its window and its front,
 * as they look a few seconds into the photos. `canvas` is sized to `width`.
 */
export declare function previewFrame(canvas: HTMLCanvasElement, width: number, opts: FrameOpts & {
    photo?: ImageBitmap;
    text: string;
}): void;
/** The best video type this browser records: MP4 where possible (Instagram and X take it), else WebM. */
export declare function recordType(): string;
/**
 * "high": ~12 Mbps at 1080×1920, sharp photos (about 45 MB for 30 s; apps
 * re-compress on upload anyway). "small": ~5 Mbps (about 20 MB for 30 s).
 */
export type Quality = "high" | "small";
export declare function scheduleSound(ctx: BaseAudioContext, out: AudioNode, track: Track, start: number, total: number, cuts?: number[], intro?: IntroSound, frame?: FrameId): void;
/**
 * Make the reel file: a standard MP4 (H.264 + AAC, one complete file with
 * its index at the start, like a phone camera's) built frame by frame with
 * the browser's encoders, faster than real time. X, Instagram Stories and
 * LinkedIn take that kind of file; the browser's recorder makes a streamed
 * MP4 some of them refuse. Browsers without those encoders record in real
 * time instead (recordRealtime).
 */
export declare function recordReel(input: ReelInput, canvas: HTMLCanvasElement, onProgress: (sec: number, total: number) => void, signal?: AbortSignal, quality?: Quality): Promise<{
    blob: Blob;
    type: string;
}>;
export {};
