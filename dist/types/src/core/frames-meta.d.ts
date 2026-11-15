/**
 * What each frame is good for, its usual size, and the music and opening
 * sound that suit it. The drawing itself is in src/engine/upstream/frames.ts.
 */
import type { IntroSound } from "../engine/upstream/music";
import type { Ratio } from "../engine/upstream/reel";
import { type FrameDef, type FrameId } from "../engine/upstream/frames";
export interface FrameMeta {
    id: FrameId;
    /** the pack it belongs to ("pizza"); a booth shows a pack's frames only when its config lists the pack */
    pack?: string;
    label: string;
    group: string;
    /** a short line on what photos it suits */
    best: string;
    /** its usual size */
    ratio: Ratio;
    /** how many photos it shows at once (1 for most) */
    photos: number;
    intro: IntroSound;
    tracks: string[];
}
/** What a frame added with registerFrame says about itself. */
export interface CustomFrameMeta {
    best: string;
    ratio: Ratio;
    /** photos shown at once (default 1) */
    photos?: number;
    intro?: IntroSound;
    tracks?: string[];
    /** its group in the picker (default its FrameDef's group) */
    group?: string;
    pack?: string;
    /** keep the frame's own colours when the booth uses its brand colours (a cardboard box stays cardboard) */
    ownColors?: boolean;
}
/**
 * Add a frame: `def` draws it (see src/packs/pizza.ts for complete
 * examples), `meta` describes it. Built-in frames can't be replaced.
 * Register before giving a booth its config, so the config can name it.
 */
export declare function registerFrame(id: string, def: FrameDef, meta: CustomFrameMeta): void;
/** Frames that keep their own colours under the brand's. */
export declare const ownColors: (id: FrameId) => boolean;
/** How many photos a frame shows at this size. */
export declare const photosFor: (id: FrameId, ratio: Ratio) => number;
/** Every frame, the most popular first. */
export declare const TOP_PICKS: FrameId[];
export declare function listFrames(): FrameMeta[];
export declare const isFrameId: (v: unknown) => v is FrameId;
export declare const frameMeta: (id: FrameId) => FrameMeta;
