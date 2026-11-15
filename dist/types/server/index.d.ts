/**
 * questpass-booth/server: optional lookups for your own server. The booth
 * itself needs no server; the editor's "Fill in from website" button calls
 * the brand lookup (brand-endpoint), and the booth's "Use my Telegram/X
 * picture" calls the picture lookup (avatar-endpoint).
 *
 *   // Next.js (app/api/brand/route.ts), Deno, Bun, Cloudflare-style runtimes with node:dns
 *   import { createBrandHandler } from "questpass-booth/server";
 *   export const GET = createBrandHandler({ allowOrigins: ["https://rsv.pizza"] });
 *
 *   // Express / Node http
 *   app.get("/api/brand", nodeBrandHandler({ allowOrigins: ["https://rsv.pizza"] }));
 *
 *   app.get("/api/avatar", nodeAvatarHandler({ allowOrigins: [...], x: true }));
 *
 * GET ?url=pizzadao.org → 200 { name, website, logo, themeColor }
 * GET ?network=telegram&handle=durov → 200 { picture }
 * 400 bad input, 403 origin not allowed, 422 site refused or unreachable,
 * 429 too many lookups, 451 brand blocked by its owner.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { type BrandOptions } from "./brand";
import { type AvatarOptions } from "./avatar";
export { fetchBrand, readPage, sniffImage, pngFromIco, siteUrl, BrandBlockedError, type BrandKit, type BrandOptions } from "./brand";
export { isPublicAddress, checkUrl, BlockedAddressError } from "./net";
export { fetchAvatar, AvatarNotFoundError, type AvatarOptions, type AvatarNetwork } from "./avatar";
export interface HandlerOptions extends BrandOptions {
    /** pages allowed to call it from a browser (exact origins); empty: same-origin only */
    allowOrigins?: string[];
    /** lookups per caller per hour (default 30) */
    perHour?: number;
    /** who the caller is, for the limit (default: the first X-Forwarded-For address, else "anon") */
    callerOf?: (req: Request) => string;
}
/** The brand lookup as a Fetch API handler: (Request) → Response. GET ?url=pizzadao.org */
export declare function createBrandHandler(opts?: HandlerOptions): (req: Request) => Promise<Response>;
/**
 * The profile-picture lookup: GET ?network=telegram&handle=durov →
 * { picture: "data:image/jpeg;base64,…" }. Nothing is kept: no cache, no log.
 */
export declare function createAvatarHandler(opts?: HandlerOptions & AvatarOptions): (req: Request) => Promise<Response>;
/**
 * The same for Express and plain Node http: (req, res). Callers are told
 * apart by their connection's address; behind a proxy, pass `callerOf`
 * (it gets the Request, with the proxy's headers).
 */
export declare function nodeBrandHandler(opts?: HandlerOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/** The picture lookup for Express and plain Node http. */
export declare function nodeAvatarHandler(opts?: HandlerOptions & AvatarOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
