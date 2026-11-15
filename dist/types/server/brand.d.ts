export interface BrandKit {
    /** the brand's name */
    name: string;
    /** the site it came from (after redirects) */
    website: string;
    /** a PNG/JPEG/WebP/GIF logo as a data URL, or "" if none was found */
    logo: string;
    /** the site's theme colour (#RRGGBB) if it declares one, else "" */
    themeColor: string;
}
export interface BrandOptions {
    /** sites never looked up (and their subdomains), e.g. brands that asked not to be used */
    blocked?: string[];
    timeoutMs?: number;
    /** the most of a page read (its <head> is near the top) */
    maxPageBytes?: number;
    maxLogoBytes?: number;
    userAgent?: string;
}
export declare class BrandBlockedError extends Error {
    constructor(host: string);
}
/** The attributes of each <meta>/<link> tag in `html`. */
export declare function tags(html: string, name: "meta" | "link"): Array<Record<string, string>>;
export interface PageInfo {
    name: string;
    themeColor: string;
    manifest: string;
    /** logo candidates, best first */
    icons: string[];
}
/** What the page's <head> says about the brand. `base` resolves relative links. */
export declare function readPage(html: string, base: URL): PageInfo;
/** The picture type from its first bytes (never trust the server's word for it). */
export declare function sniffImage(b: Buffer): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null;
/**
 * The biggest PNG inside a .ico file (modern favicons store their large
 * sizes as PNG), or null. Only PNG entries are taken, so nothing needs
 * decoding here.
 */
export declare function pngFromIco(b: Buffer): Buffer | null;
/** "pizzadao.org", "https://pizzadao.org/about" → a checked https URL to start from. */
export declare function siteUrl(input: string): URL;
export declare function fetchBrand(input: string, opts?: BrandOptions): Promise<BrandKit>;
