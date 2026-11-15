/**
 * Stands in for QuestPass's sponsor registry (@/config/sponsors) inside the
 * engine. A booth has one brand at a time: the runtime sets it before every
 * render (see src/core/brand.ts), and the engine reads it through
 * pageSponsor().
 */
export interface SponsorTheme {
    accent: string;
    accentDark: string;
    accentSoft: string;
    highlight: string;
    highlight2: string;
    base: string;
    surface: string;
    surface2: string;
    text: string;
}
export interface SponsorBrand {
    id: string;
    name: string;
    url: string;
    wordmark: {
        src: string;
        width: number;
        height: number;
        alt: string;
    };
    logo: {
        width: number;
        height: number;
        mark: string[];
        word: string[];
        markColor: string;
        wordColor: string;
    };
    logoImage?: string;
    theme: SponsorTheme;
    copy: {
        presentedBy: string;
        poweredBy: string;
        posterNote: string;
    };
    ownedSlots: number[];
    themeOwnedBoards?: boolean;
    seekingSponsors?: boolean;
    ticketPrefix: string;
}
export declare const DEFAULT_THEME: SponsorTheme;
/** The brand the next render uses. */
export declare function setActiveSponsor(b: SponsorBrand): void;
export declare const activeSponsor: () => SponsorBrand;
export declare const pageSponsor: () => SponsorBrand;
