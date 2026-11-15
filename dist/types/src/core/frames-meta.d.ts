/**
 * What each frame is good for, its usual size, and the music and opening
 * sound that suit it. The drawing itself is in src/engine/upstream/frames.ts.
 */
import type { IntroSound } from "../engine/upstream/music";
import type { Ratio } from "../engine/upstream/reel";
import { type FrameId } from "../engine/upstream/frames";
export interface FrameMeta {
    id: FrameId;
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
/** How many photos a frame shows at this size. */
export declare const photosFor: (id: FrameId, ratio: Ratio) => 8 | 1 | 4 | 6;
/** Every frame, the most popular first. */
export declare const TOP_PICKS: FrameId[];
export declare function listFrames(): FrameMeta[];
export declare const isFrameId: (v: unknown) => v is FrameId;
export declare const frameMeta: (id: FrameId) => FrameMeta;
