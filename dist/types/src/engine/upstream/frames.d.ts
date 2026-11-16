/**
 * Reel frames: each wraps the finished reel (see reel.ts) at any output
 * ratio. A frame gives the window the reel fills (the reel is drawn at that
 * shape, so nothing is shrunk to fit) and draws around it. Bands are sized
 * in fixed units (1080-wide grid), not fractions, so on a wide 16:9 video
 * the branding stays small and the reel gets the space. Every frame carries
 * the branding (event, QuestPass, sponsor, credit) outside the window, where
 * a crop of the top or bottom only loses branding, not the photos.
 * Adding a frame is adding an entry here.
 */
import type { JourneyInput } from "../../shims/journey";
import type { SponsorBrand } from "../../shims/sponsors";
import { type ReelStats } from "./reel";
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export interface FrameCtx {
    W: number;
    H: number;
    /** 1 on a 1080 grid (min side / 1080) */
    u: number;
    /** where the reel is drawn */
    R: Rect;
    t: number;
    total: number;
    /** the current photo's text (or the intro headline) */
    text: string;
    /** the current photo's date (YYYY-MM-DD), if it has one */
    date?: string;
    sponsor: SponsorBrand;
    eventName: string;
    eventDates: string;
    journey: JourneyInput;
    stats?: ReelStats;
    /** this person's reel link (questpass.live/reel/<their QR code>), for the frames' QR codes */
    link?: string;
    /** the postcard's message, written by the person */
    note?: string;
    /**
     * 1 while the reel's own name card or closing card shows (they carry the
     * sponsor and QuestPass themselves), 0 otherwise: the frame's sponsor and
     * credit lines fade out meanwhile, so they don't show twice at once.
     */
    promo?: number;
    /** the colours picked for this frame (one of its palettes, or made from a photo) */
    pal: Palette;
    /**
     * A booth outside the event (/snap, a sponsor's /b/<name>): its own
     * wording instead of the Devcon Mumbai lines. Unset: the event's.
     */
    brand?: FrameBrand;
    /**
     * Words for the frames' text spaces (src/config/frame-words.ts), by id:
     * a space left out shows the frame's own default, "" leaves it off.
     */
    words?: Record<string, string>;
    /** every photo of the reel, for frames that show more than the one playing (photo booth, photo dump) */
    photos?: ImageBitmap[];
    /** while a photo plays: its place in the reel (i of n) and how far through it is (0–1) */
    seg?: {
        i: number;
        n: number;
        p: number;
    };
}
/**
 * A frame's colours. Every frame reads these instead of fixed colours, so
 * each can come in a few ready-made sets (the first is its usual look).
 * bg/fg/muted: the backdrop and text on it; paper/ink: the card or sheet and
 * text on it; accent/accent2: the frame's own highlights.
 */
export interface Palette {
    name: string;
    bg: string;
    fg: string;
    muted: string;
    paper: string;
    ink: string;
    accent: string;
    accent2: string;
    /** the game card only: a rarity's colours instead of the person's own */
    rarity?: keyof typeof RARITY;
}
/** `c` (a #RRGGBB colour) at opacity `a`. Other colour strings come back unchanged. */
export declare function withA(c: string, a: number): string;
/** Mix two #RRGGBB colours (k = 0: a, 1: b). */
export declare function mix(a: string, b: string, k: number): string;
/** 0 (black) to 1 (white). */
export declare function lightness(c: string): number;
/**
 * A palette from a photo: its strongest colour becomes the accent, the
 * backdrop a deep (or pale, for light frames) shade of it.
 */
export declare function paletteFromPhoto(base: Palette, img: CanvasImageSource): Palette;
/** A palette around one colour: it becomes the accent, the backdrop a deep (or pale, for light frames) shade of it. */
export declare function paletteFromAccent(base: Palette, accent: string, name?: string): Palette;
export type FrameGroup = "Fun" | "Clean" | "Retro" | "Travel" | "For devs" | "Festive";
export interface FrameDef {
    label: string;
    group: FrameGroup;
    /** its colour sets, the usual one first (a function: some follow the site's theme, read when drawn) */
    palettes(): Palette[];
    /** the window the reel fills */
    window(W: number, H: number, u: number): Rect;
    /** drawn before the reel */
    back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    /** drawn over it */
    front?(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    /** the frame shows each photo's text itself (so the reel leaves it off the photo) */
    ownsText?: boolean;
    /** the frame prints the photo's date itself (so the reel leaves its date stamp off) */
    ownsDate?: boolean;
    /** radians the reel is turned by */
    tilt?: number;
    /** picture corners the watermark may use (the rest hold the frame's own marks); default all */
    marks?: Corner[];
}
export type Corner = "tl" | "tr" | "bl" | "br";
/** A booth's own wording for the frames (see FrameCtx.brand). Empty strings leave a line off. */
export interface FrameBrand {
    /** where it is ("Mumbai" on the event's frames) */
    place: string;
    /** the site's name in the corners ("QuestPass") */
    mark: string;
    /** the site's address ("questpass.live") */
    site: string;
    /** the small credit line */
    credit: string;
    /** show "powered by" and the sponsor's logo */
    sponsor: boolean;
    /** a logo for the newspaper's advertisement box (loaded before drawing) */
    adLogo?: string;
}
/**
 * The sponsor's logo, with a light or dark plate behind it when the logo's
 * colour is too close to what is under it (a black logo on a dark frame, a
 * white one on newsprint), so it always reads. Returns the width drawn.
 */
export declare function sponsorLogo(ctx: CanvasRenderingContext2D, sponsor: SponsorBrand, x: number, y: number, h: number): number;
declare const RARITY: {
    readonly legendary: {
        readonly name: "LEGENDARY";
        readonly stars: "★★★★★";
        readonly base: readonly ["#2B1650", "#0F0A22"];
        readonly foil: readonly ["#FF7AD9", "#FFE27A", "#7AF0FF", "#B07CFF"];
        readonly accent: "#FFE27A";
    };
    readonly epic: {
        readonly name: "EPIC";
        readonly stars: "★★★★";
        readonly base: readonly ["#2A1240", "#0E0A1C"];
        readonly foil: readonly ["#C77DFF", "#FF8AD8", "#9AE6FF", "#E9B8FF"];
        readonly accent: "#E9B8FF";
    };
    readonly rare: {
        readonly name: "RARE";
        readonly stars: "★★★";
        readonly base: readonly ["#2E2208", "#120D04"];
        readonly foil: readonly ["#FFE08A", "#B8862B", "#FFF6D6", "#F2C94C"];
        readonly accent: "#F2C94C";
    };
    readonly uncommon: {
        readonly name: "UNCOMMON";
        readonly stars: "★★";
        readonly base: readonly ["#1E2530", "#0C1016"];
        readonly foil: readonly ["#E6EEF7", "#8DA2B8", "#FFFFFF", "#AFC3D6"];
        readonly accent: "#DDE7F2";
    };
};
export declare function drawQr(ctx: CanvasRenderingContext2D, data: string, x: number, y: number, size: number, ink: string, opts?: {
    round?: boolean;
    accent?: string;
    avatar?: CanvasImageSource & {
        width: number;
        height: number;
    };
    letter?: string;
}): void;
declare function codeWindow(W: number, H: number, u: number): Rect;
declare const DEFS: {
    clean: {
        label: string;
        group: "Clean";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    newspaper: {
        label: string;
        group: "Retro";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        ownsText: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    pass: {
        label: string;
        group: "Travel";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: "tr"[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    passport: {
        label: string;
        group: "Travel";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: "tr"[];
        ownsDate: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    ticket: {
        label: string;
        group: "Travel";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: ("tr" | "br")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    polaroid: {
        label: string;
        group: "Clean";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        tilt: number;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    film: {
        label: string;
        group: "Retro";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    cinema: {
        label: string;
        group: "Retro";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: ("tl" | "tr" | "bl")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    vhs: {
        label: string;
        group: "Retro";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: "br"[];
        ownsDate: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    postcard: {
        label: string;
        group: "Retro";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: ("tl" | "bl" | "br")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    scrapbook: {
        label: string;
        group: "Retro";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        tilt: number;
        marks: ("tr" | "bl")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    magazine: {
        label: string;
        group: "Clean";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: never[];
        ownsText: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    calendar: {
        label: string;
        group: "Clean";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: ("tr" | "br")[];
        ownsDate: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    player: {
        label: string;
        group: "Clean";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: ("tl" | "tr")[];
        ownsText: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    tablet: {
        label: string;
        group: "For devs";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: ("bl" | "br")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    code: {
        label: string;
        group: "For devs";
        palettes: () => Palette[];
        window: typeof codeWindow;
        marks: ("tr" | "br")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    lanyard: {
        label: string;
        group: "For devs";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: "tl"[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    gamecard: {
        label: string;
        group: "Fun";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        } | {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: ("tl" | "tr")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    booth: {
        label: string;
        group: "Fun";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: "tr"[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    dump: {
        label: string;
        group: "Fun";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        marks: ("tr" | "br")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    story: {
        label: string;
        group: "Fun";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: never[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    comic: {
        label: string;
        group: "Fun";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        tilt: number;
        marks: "tl"[];
        ownsText: true;
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    neon: {
        label: string;
        group: "Fun";
        palettes: () => Palette[];
        window: (W: number, H: number, u: number) => Rect;
        marks: ("tr" | "br")[];
        back(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
        front(ctx: CanvasRenderingContext2D, f: FrameCtx): void;
    };
    "festive-prints": FrameDef;
    "prints-collage": FrameDef;
};
export type FrameId = keyof typeof DEFS;
export declare const FRAMES: Record<FrameId, FrameDef>;
export declare const FRAME_IDS: FrameId[];
/** The frames a booth outside the event offers: all of them (the pass frames print the booth's own route, stamps and badge instead of the pass's). */
export declare const OPEN_FRAME_IDS: FrameId[];
/** The frames shown first (the "Top picks" tab, and the start of "All"). */
export declare const TOP_PICKS: FrameId[];
/** These frames, the top picks first. */
export declare const picksFirst: (ids: FrameId[]) => FrameId[];
/** A kind of frame's name on its tab. */
export declare const groupName: (g: string) => string;
/** A photo's shape: wide (landscape), square, or tall (portrait). */
export type PhotoShape = "wide" | "square" | "tall";
export declare const shapeOf: (w: number, h: number) => PhotoShape;
/** Frames that suit a photo of this shape, best first (each made at the shape's size: wide 16:9, square 1:1, tall its own). */
export declare const FITS: Record<PhotoShape, FrameId[]>;
export {};
