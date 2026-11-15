import { type FrameId } from "../engine/upstream/frames";
export declare const CONFIG_VERSION = 1;
export type WordMode = "fixed" | "edit" | "off";
export type HeadingFont = "default" | "condensed";
export interface BoothColors {
    /** buttons, highlights, the frames' main colour */
    accent: string;
    /** a second colour: dates, stars */
    highlight: string;
    /** backdrop */
    base: string;
    /** text on the backdrop */
    text: string;
}
export interface BoothConfig {
    version: typeof CONFIG_VERSION;
    /** the booth's title on the frames and the video ("Global Pizza Party") */
    title: string;
    /** where ("Mumbai"); empty leaves it off */
    place: string;
    /** a date line under the title ("Sat 17 May 2026"); empty leaves it off */
    dates: string;
    brand: {
        /** the brand's name, shown when there's no logo */
        name: string;
        /** its website, for the frames that print an address */
        website: string;
        /** its logo: a data: image (made by the editor) or an https image URL that allows CORS; empty for none */
        logo: string;
        colors: BoothColors;
        /** the booth's own title and buttons: "default" (Inter) or "condensed" (Asap Condensed, heavy) */
        headingFont: HeadingFont;
    };
    /** show the brand's logo on the frames and the video's cards */
    showBrand: boolean;
    /** "made with QuestPass" on the frames and the video (please keep it on; see NOTICE) */
    credit: boolean;
    frames: {
        /** the frames people can pick, or all of them (all built-in frames, plus the frames of the packs below) */
        allow: FrameId[] | "all";
        /** the one it opens with */
        default: FrameId;
        /** frames shown first in the picker, in this order */
        first: FrameId[];
    };
    /** frame packs to include (["pizza"]: the Pizza DAO frames) */
    packs: string[];
    /** the person in the photo */
    person: {
        /** show the whole name ("Chorizo Corleone"), not just the first word */
        wholeName: boolean;
        /** the name field's label ("Your mafia name") */
        nameLabel: string;
        /** the line field's label ("Your line"); the line is the photo's caption */
        lineLabel: string;
        /** names to pick from as you type (e.g. the members' mafia names); up to 5,000 */
        names: string[];
        /** a 🎲 button makes a name from one word of each list (both needed) */
        suggest: {
            first: string[];
            last: string[];
        };
    };
    /** the frames' text spaces, by id (see listWordSlots): fixed words, people write, or off */
    words: Record<string, {
        mode: WordMode;
        text: string;
    }>;
    video: {
        /** let people make a video from their photos */
        enabled: boolean;
        /** a QR code and link on the video's last card (needs share.link) */
        qr: boolean;
        /** the brand's logo on the last card */
        showBrand: boolean;
    };
    share: {
        /** the words that go with a shared photo or video; {link} is replaced by share.link */
        text: string;
        /** the booth's own page, for "make yours" and the QR (https only); empty for none */
        link: string;
    };
    camera: {
        /** the camera turns itself off this many seconds after it's opened (10–120) */
        idleSeconds: number;
        /** a 3-second countdown before each shot */
        timer: boolean;
    };
    /** photos kept at once (1–20) */
    maxPhotos: number;
}
export declare const DEFAULT_COLORS: BoothColors;
export declare function defaultConfig(): BoothConfig;
/** Limits on lengths, so a config can't blow up the layout or memory. */
export declare const LIMITS: {
    readonly title: 40;
    readonly place: 30;
    readonly dates: 40;
    readonly name: 40;
    readonly website: 200;
    readonly shareText: 280;
    readonly link: 300;
    readonly logoBytes: 1500000;
};
type Obj = Record<string, unknown>;
/** Plain text: control characters removed, trimmed, cut to `max`. */
export declare const cleanText: (v: unknown, max: number, fallback?: string) => string;
export declare const isColor: (v: unknown) => v is string;
/** An http(s) URL with no credentials in it, else "". */
export declare function cleanUrl(v: unknown, max?: number, httpsOnly?: boolean): string;
/** A logo: a base64 PNG/JPEG/WebP/GIF data URL (not SVG: it can carry scripts) under the size limit, or an https URL. */
export declare function cleanLogo(v: unknown): string;
/** Bring an older config up to this version. */
export declare function migrateConfig(input: Obj): Obj;
/** Any input (JSON from anywhere) → a complete, safe BoothConfig. */
export declare function normalizeConfig(input: unknown): BoothConfig;
/** The frames this booth offers, in picker order ("first" ones, then the rest). */
export declare function offeredFrames(c: BoothConfig): FrameId[];
/**
 * Add a text space to a frame (for frames added with registerFrame). The
 * frame reads it from f.words[id] (undefined: its default; "": off).
 */
export declare function registerWordSlot(slot: {
    id: string;
    frame: string;
    label: string;
    max: number;
    placeholder: string;
    defaultMode: WordMode;
}): void;
/** The text spaces, for an editor: id, which frame, label, length limit, what shows when empty, and the default mode. */
export declare const listWordSlots: () => {
    id: string;
    frame: string;
    label: string;
    max: number;
    placeholder: string;
    defaultMode: WordMode;
}[];
/** The share text with the link filled in. */
export declare const shareTextOf: (c: BoothConfig) => string;
export {};
