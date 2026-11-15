/**
 * Fetching someone else's website safely from your server. The brand lookup
 * takes a URL typed by a user, so without care it could be pointed at your
 * own network (http://169.254.169.254/, http://localhost:6379/, a router):
 * "server-side request forgery". Every request here:
 *  - is http(s) only, on the standard ports, with no user:password@ part;
 *  - connects only to public addresses: the address is checked at the moment
 *    of connecting (a custom DNS lookup), so a name that later points
 *    somewhere private (DNS rebinding) is still refused;
 *  - follows at most 3 redirects, each checked the same way;
 *  - stops after a time limit and a size limit, and sends no cookies.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

export class BlockedAddressError extends Error {
  constructor(what: string) {
    super(`refused: ${what}`);
    this.name = "BlockedAddressError";
  }
}

const v4 = (ip: string) => ip.split(".").map(Number) as [number, number, number, number];

/** True for an address on the public internet (not private, loopback, link-local, reserved…). */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c] = v4(ip);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a >= 224) return false; // multicast, reserved, broadcast
    return true;
  }
  if (kind === 6) {
    const x = ip.toLowerCase().split("%")[0]!;
    if (x === "::" || x === "::1") return false;
    // IPv4 inside IPv6 (::ffff:10.0.0.1, ::ffff:a00:1, 64:ff9b::10.0.0.1): judge the IPv4 part
    const mapped = /^(?:::ffff:|64:ff9b::)(?:0:)?(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPublicAddress(mapped[1]!);
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1]!, 16);
      const lo = parseInt(hexMapped[2]!, 16);
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(x.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
    if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
    if ((first & 0xff00) === 0xff00) return false; // multicast
    if (x.startsWith("2001:db8:") || x.startsWith("2001:0db8:")) return false; // documentation
    if (x.startsWith("64:ff9b:") || x.startsWith("2002:") || x.startsWith("::")) return false; // translated or embedded IPv4 (NAT64, 6to4, compatible)
    return true;
  }
  return false;
}

/** A DNS lookup that refuses names resolving to any non-public address. */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new BlockedAddressError(`${hostname} is not a public address`), "", 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

/** A URL we're willing to request: http(s), standard port, no credentials, not a private IP literal. */
export function checkUrl(raw: string | URL): URL {
  const u = new URL(String(raw));
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedAddressError("only http and https");
  if (u.username || u.password) throw new BlockedAddressError("no credentials in URLs");
  if (u.port && u.port !== "80" && u.port !== "443") throw new BlockedAddressError("only ports 80 and 443");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new BlockedAddressError(`${host} is not a public address`);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new BlockedAddressError(`${host} is not public`);
  return u;
}

export interface Fetched {
  url: URL;
  status: number;
  type: string;
  body: Buffer;
}

export interface GetOptions {
  maxBytes: number;
  timeoutMs: number;
  accept: string;
  userAgent: string;
}

/** GET a public URL within the limits above. */
export async function safeGet(raw: string | URL, o: GetOptions, redirects = 3): Promise<Fetched> {
  const url = checkUrl(raw);
  const res = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: { accept: o.accept, "accept-encoding": "identity", "user-agent": o.userAgent },
        timeout: o.timeoutMs,
      },
      (r) => {
        const chunks: Buffer[] = [];
        let size = 0;
        r.on("data", (c: Buffer) => {
          size += c.length;
          if (size > o.maxBytes) {
            // enough: keep what fits (a page's <head> is near the top)
            chunks.push(c.subarray(0, Math.max(0, c.length - (size - o.maxBytes))));
            r.destroy();
            resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks) });
            return;
          }
          chunks.push(c);
        });
        r.on("end", () => resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks) }));
        r.on("error", reject);
      },
    );
    const timer = setTimeout(() => req.destroy(new Error("timed out")), o.timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    req.end();
  });
  if (res.status >= 300 && res.status < 400 && res.headers.location) {
    if (redirects <= 0) throw new Error("too many redirects");
    return safeGet(new URL(res.headers.location, url), o, redirects - 1);
  }
  return { url, status: res.status, type: String(res.headers["content-type"] ?? "").toLowerCase(), body: res.body };
}
