import { type Quality } from "../engine/upstream/reel";
import type { FrameId } from "../engine/upstream/frames";
import { type FrameOptions } from "./render";
/** The longest stretch of a clip used (seconds). */
export declare const CLIP_MAX_SEC = 30;
/** Clips longer than this aren't opened (seconds): phones run out of memory. */
export declare const CLIP_SOURCE_MAX_SEC: number;
/** A video clip that can be drawn at any moment of it (onto `canvas`). */
export declare class ClipSource {
    readonly video: HTMLVideoElement;
    readonly canvas: HTMLCanvasElement;
    readonly url: string;
    readonly blob: Blob;
    duration: number;
    private at;
    private constructor();
    /** Open a clip (a File or Blob): its size and length are read, and its first frame drawn. */
    static open(blob: Blob): Promise<ClipSource>;
    /** Draw the clip's frame at `t` seconds onto `canvas` (seeking there first). */
    frameAt(t: number): Promise<HTMLCanvasElement>;
    /** Draw whatever frame the video shows now (while it plays). */
    draw(): void;
    close(): void;
}
export type ClipSound = "clip" | "music" | "both";
export interface ClipVideoOptions extends Omit<FrameOptions, "photos"> {
    clip: ClipSource;
    /** where to start in the clip, and how long (at most CLIP_MAX_SEC) */
    start?: number;
    length?: number;
    /** the clip's own sound, the booth's music, or both (music softer) */
    sound?: ClipSound;
    /** a track id (listTracks) for the music */
    track?: string;
    quality?: Quality;
    onProgress?: (seconds: number, total: number) => void;
    signal?: AbortSignal;
}
/**
 * The clip playing inside the frame, as a video file: an MP4 (H.264 + AAC)
 * made faster than real time where the browser can encode, else recorded as
 * it plays (MP4 or WebM, whatever the browser records).
 */
export declare function makeClipVideo(o: ClipVideoOptions): Promise<{
    blob: Blob;
    type: string;
}>;
export type { FrameId };
