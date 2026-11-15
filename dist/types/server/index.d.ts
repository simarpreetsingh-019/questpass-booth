/**
 * questpass-booth/server: the optional brand lookup for your own server.
 * The booth itself needs no server; only the editor's "fill in from a
 * website" button calls this, at the URL you give it (brand-endpoint).
 *
 *   // Next.js (app/api/brand/route.ts), Deno, Bun, Cloudflare-style runtimes with node:dns
 *   import { createBrandHandler } from "questpass-booth/server";
 *   export const GET = createBrandHandler({ allowOrigins: ["https://rsv.pizza"] });
 *
 *   // Express / Node http
 *   app.get("/api/brand", nodeBrandHandler({ allowOrigins: ["https://rsv.pizza"] }));
 *
 * GET ?url=pizzadao.org → 200 { name, website, logo, themeColor }
 * 400 bad input, 403 origin not allowed, 422 site refused or unreachable,
 * 429 too many lookups, 451 brand blocked by its owner.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { type BrandOptions } from "./brand";
export { fetchBrand, readPage, sniffImage, pngFromIco, siteUrl, BrandBlockedError, type BrandKit, type BrandOptions } from "./brand";
export { isPublicAddress, checkUrl, BlockedAddressError } from "./net";
export interface HandlerOptions extends BrandOptions {
    /** pages allowed to call it from a browser (exact origins); empty: same-origin only */
    allowOrigins?: string[];
    /** lookups per caller per hour (default 30) */
    perHour?: number;
    /** who the caller is, for the limit (default: the first X-Forwarded-For address, else "anon") */
    callerOf?: (req: Request) => string;
}
/** A Fetch API handler: (Request) → Response. */
export declare function createBrandHandler(opts?: HandlerOptions): (req: Request) => Promise<Response>;
/**
 * The same for Express and plain Node http: (req, res). Callers are told
 * apart by their connection's address; behind a proxy, pass `callerOf`
 * (it gets the Request, with the proxy's headers).
 */
export declare function nodeBrandHandler(opts?: HandlerOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
