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
import { BrandBlockedError, fetchBrand, type BrandKit, type BrandOptions } from "./brand";
import { BlockedAddressError } from "./net";
import { AvatarNotFoundError, fetchAvatar, type AvatarOptions } from "./avatar";

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

const hits = new Map<string, number[]>();
function limited(key: string, perHour: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= perHour) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return false;
}

/** The checks every lookup shares: method, which sites may call it, the rate limit. Then `run`. */
function endpoint(opts: HandlerOptions, what: string, run: (params: URLSearchParams) => Promise<[number, unknown]>) {
  const allow = new Set(opts.allowOrigins ?? []);
  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    const cors: Record<string, string> = origin && allow.has(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...cors } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET", "access-control-max-age": "600" } });
    if (req.method !== "GET") return json(405, { error: "GET only" });
    // a browser on another site that isn't on the list: refuse (same-origin requests send no Origin on GET, or their own)
    if (origin && !allow.has(origin) && origin !== new URL(req.url).origin) return json(403, { error: `This site may not use the ${what}.` });
    const caller = opts.callerOf?.(req) ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    if (limited(`${what}|${caller}`, opts.perHour ?? 30)) return json(429, { error: "Too many lookups. Try again in a while." });
    const [status, body] = await run(new URL(req.url).searchParams);
    return json(status, body);
  };
}

const brands = new Map<string, { at: number; kit: BrandKit }>();

/** The brand lookup as a Fetch API handler: (Request) → Response. GET ?url=pizzadao.org */
export function createBrandHandler(opts: HandlerOptions = {}) {
  return endpoint(opts, "brand lookup", async (q) => {
    const input = q.get("url") ?? "";
    if (!input.trim() || input.length > 300) return [400, { error: "Add ?url=<website>." }];
    const key = input.trim().toLowerCase();
    const hit = brands.get(key);
    if (hit && Date.now() - hit.at < 3600_000) return [200, hit.kit];
    try {
      const kit = await fetchBrand(input, opts);
      if (brands.size > 500) brands.clear();
      brands.set(key, { at: Date.now(), kit });
      return [200, kit];
    } catch (e) {
      if (e instanceof BrandBlockedError) return [451, { error: "This brand asked not to be used." }];
      if (e instanceof BlockedAddressError) return [422, { error: "That address can't be looked up." }];
      return [422, { error: "Couldn't read that website. Add the logo and colours by hand." }];
    }
  });
}

/**
 * The profile-picture lookup: GET ?network=telegram&handle=durov →
 * { picture: "data:image/jpeg;base64,…" }. Nothing is kept: no cache, no log.
 */
export function createAvatarHandler(opts: HandlerOptions & AvatarOptions = {}) {
  return endpoint(opts, "picture lookup", async (q) => {
    const network = q.get("network") ?? "";
    const handle = (q.get("handle") ?? "").slice(0, 40);
    try {
      return [200, { picture: await fetchAvatar(network, handle, opts) }];
    } catch (e) {
      return [422, { error: e instanceof AvatarNotFoundError ? e.message : "Couldn't get that picture. Upload one instead." }];
    }
  });
}

/**
 * The same for Express and plain Node http: (req, res). Callers are told
 * apart by their connection's address; behind a proxy, pass `callerOf`
 * (it gets the Request, with the proxy's headers).
 */
export function nodeBrandHandler(opts: HandlerOptions = {}) {
  return toNode((callerOf) => createBrandHandler({ ...opts, callerOf: opts.callerOf ?? callerOf }));
}

/** The picture lookup for Express and plain Node http. */
export function nodeAvatarHandler(opts: HandlerOptions & AvatarOptions = {}) {
  return toNode((callerOf) => createAvatarHandler({ ...opts, callerOf: opts.callerOf ?? callerOf }));
}

function toNode(make: (callerOf: (r: Request) => string) => (req: Request) => Promise<Response>) {
  const SOCKET = "x-questpass-booth-peer";
  const handle = make((r) => r.headers.get(SOCKET) ?? "anon");
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    // set here, after the caller's own headers, so it can't be faked
    headers.set(SOCKET, req.socket.remoteAddress ?? "anon");
    const r = await handle(new Request(url, { method: req.method, headers }));
    res.statusCode = r.status;
    r.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await r.arrayBuffer()));
  };
}
