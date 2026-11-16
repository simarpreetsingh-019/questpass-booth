/**
 * Framed photos and videos, made on the device. Nothing here sends anything
 * anywhere: photos go in, a Blob comes out, and what happens to it (save,
 * share, upload to the host's own gallery) is the host page's choice.
 */
import { type FrameId } from "../engine/upstream/frames";
import { type IntroSound } from "../engine/upstream/music";
import { type Quality, type Ratio } from "../engine/upstream/reel";
import type { ClipSource } from "./clip";
import { type BoothConfig } from "./config";
import { photosFor } from "./frames-meta";
import { type Network } from "./handle";
export type { FrameId, Ratio, Quality, IntroSound };
export declare const RATIO_SIZES: Record<Ratio, [number, number]>;
/** Anything a photo can come from. */
export type PhotoSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | Blob;
/** The frame's colours: the brand's, made from the first photo, or one of the frame's own sets (by number). */
export type PaletteChoice = "brand" | "photo" | number;
export interface FrameOptions {
    /** the booth's settings (any JSON; it is checked and completed first) */
    config: BoothConfig | unknown;
    /** the photos, the main one first (multi-photo frames use the rest too) */
    photos: PhotoSource[];
    frame?: FrameId;
    ratio?: Ratio;
    palette?: PaletteChoice;
    /** what the person typed in the frame's text spaces they may fill in, by slot id */
    words?: Record<string, string>;
    /** their name (optional, shown on some frames) */
    name?: string;
    /** the photo's caption */
    caption?: string;
    /** their picture (a profile picture, an NFT): in the name tag on every frame, and on frames that show one */
    avatar?: PhotoSource;
    /** their username, in the name tag on every frame */
    handle?: {
        network: Network;
        username: string;
    };
}
/** A photo as an ImageBitmap the frames can draw (EXIF rotation applied, very big ones shrunk). */
export declare function toBitmap(src: PhotoSource, maxSide?: number): Promise<ImageBitmap>;
/** The frame's colour sets, by number (for a picker): name and accent. */
export declare const framePalettes: (frame: FrameId) => {
    index: number;
    name: string;
    accent: string;
    bg: string;
}[];
/** Draw the framed photo onto `canvas` at `width` pixels across (its height follows the size). */
export declare function drawPreview(canvas: HTMLCanvasElement, width: number, o: FrameOptions): Promise<void>;
/**
 * The framed photo as an image file. `hd` draws it at twice the size (a
 * Story is 2160×3840), so the photo inside the frame stays sharp.
 */
export declare function renderPhoto(o: FrameOptions & {
    hd?: boolean;
    type?: "image/jpeg" | "image/png";
}): Promise<Blob>;
/** The music, by id (all made in code on the device: nothing licensed, nothing downloaded). */
export declare const listTracks: () => {
    id: string;
    name: string;
    bpm: number;
}[];
/** A video clip in the recap: which clip, from where, for how long. */
export interface ClipItem {
    clip: ClipSource;
    start?: number;
    length?: number;
}
/** The longest a clip plays inside the recap video (seconds). */
export declare const REEL_CLIP_MAX_SEC = 10;
export interface VideoOptions extends FrameOptions {
    /** the line under the title on the opening card */
    title?: string;
    /** a track id from listTracks() (default: one that suits the frame) */
    track?: string;
    intro?: IntroSound;
    /** each photo's own caption, in the same order as `photos` */
    captions?: string[];
    /** video clips to mix in with the photos (each up to REEL_CLIP_MAX_SEC) */
    clips?: ClipItem[];
    /** photos and clips in the order they play (default: the photos, then the clips) */
    order?: Array<PhotoSource | ClipItem>;
    /** the clips' own sound under the music (default true; the music goes softer) */
    clipSound?: boolean;
    /** "music": cuts follow the track; "fast": twice as quick */
    timing?: "music" | "fast";
    quality?: Quality;
    onProgress?: (seconds: number, total: number) => void;
    signal?: AbortSignal;
}
/**
 * A video of the photos with music: an MP4 (H.264 + AAC) where the browser
 * can encode one, else WebM recorded in real time. About 15–40 s.
 */
export declare function makeVideo(o: VideoOptions): Promise<{
    blob: Blob;
    type: string;
}>;
/** How many photos a frame takes at a size (1 for most; the photo strip 4, the photo dump 6–8). */
export { photosFor };
/**
 * For live previews (the camera inside the frame, 15 times a second):
 * everything is prepared once, then each draw is synchronous. The photos
 * can be ImageBitmaps or canvases (a camera frame).
 */
export declare function createPreviewer(o: Omit<FrameOptions, "photos">): Promise<{
    frame: "clean" | "newspaper" | "pass" | "passport" | "ticket" | "polaroid" | "film" | "cinema" | "vhs" | "postcard" | "scrapbook" | "magazine" | "calendar" | "player" | "tablet" | "code" | "lanyard" | "gamecard" | "booth" | "dump" | "story" | "comic" | "neon" | "festive-prints" | "prints-collage";
    ratio: Ratio;
    config: BoothConfig;
    draw(canvas: HTMLCanvasElement, width: number, photos: Array<ImageBitmap | HTMLCanvasElement>): void;
}>;
