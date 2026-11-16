/*! QuestPass Booth 1.3.0 | Apache-2.0 | (c) Simarpreet Singh | https://github.com/simarpreetsingh-019/questpass-booth */

// server/net.ts
import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
var BlockedAddressError = class extends Error {
  constructor(what) {
    super(`refused: ${what}`);
    this.name = "BlockedAddressError";
  }
};
var v4 = (ip) => ip.split(".").map(Number);
function isPublicAddress(ip) {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c] = v4(ip);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a >= 224) return false;
    return true;
  }
  if (kind === 6) {
    const x = ip.toLowerCase().split("%")[0];
    if (x === "::" || x === "::1") return false;
    const mapped = /^(?:::ffff:|64:ff9b::)(?:0:)?(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPublicAddress(mapped[1]);
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(x.split(":")[0] || "0", 16);
    if ((first & 65024) === 64512) return false;
    if ((first & 65472) === 65152) return false;
    if ((first & 65280) === 65280) return false;
    if (x.startsWith("2001:db8:") || x.startsWith("2001:0db8:")) return false;
    if (x.startsWith("64:ff9b:") || x.startsWith("2002:") || x.startsWith("::")) return false;
    return true;
  }
  return false;
}
var guardedLookup = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses;
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new BlockedAddressError(`${hostname} is not a public address`), "", 4);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};
function checkUrl(raw) {
  const u = new URL(String(raw));
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedAddressError("only http and https");
  if (u.username || u.password) throw new BlockedAddressError("no credentials in URLs");
  if (u.port && u.port !== "80" && u.port !== "443") throw new BlockedAddressError("only ports 80 and 443");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new BlockedAddressError(`${host} is not a public address`);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new BlockedAddressError(`${host} is not public`);
  return u;
}
async function safeGet(raw, o, redirects = 3) {
  const url = checkUrl(raw);
  const res = await new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: { accept: o.accept, "accept-encoding": "identity", "user-agent": o.userAgent },
        timeout: o.timeoutMs
      },
      (r) => {
        const chunks = [];
        let size = 0;
        r.on("data", (c) => {
          size += c.length;
          if (size > o.maxBytes) {
            chunks.push(c.subarray(0, Math.max(0, c.length - (size - o.maxBytes))));
            r.destroy();
            resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks) });
            return;
          }
          chunks.push(c);
        });
        r.on("end", () => resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks) }));
        r.on("error", reject);
      }
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

// server/brand.ts
var BrandBlockedError = class extends Error {
  constructor(host) {
    super(`${host} is blocked`);
    this.name = "BrandBlockedError";
  }
};
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
var decode = (s) => s.replace(
  /&(#x[0-9a-f]+|#\d+|\w+);/gi,
  (m, e) => e[0] === "#" ? String.fromCodePoint(e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m
);
function tags(html, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  for (const m of html.matchAll(re)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[a[1].toLowerCase()] = decode(a[3] ?? a[4] ?? a[5] ?? "").trim();
    }
    out.push(attrs);
  }
  return out;
}
var hexColor = (v) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((v ?? "").trim());
  if (!m) return "";
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
};
var cleanName = (s) => decode(s).replace(/\s+/g, " ").trim().slice(0, 40);
function readPage(html, base) {
  const end = html.search(/<\/head>/i);
  const head = end >= 0 ? html.slice(0, end) : html;
  const metas = tags(head, "meta");
  const links = tags(head, "link");
  const meta = (key) => metas.find((m) => (m.property ?? m.name ?? "").toLowerCase() === key)?.content;
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ?? "";
  const fromTitle = decode(title).split(/\s+[|·•–—-]\s+|:\s+/)[0] ?? "";
  const name = cleanName(meta("og:site_name") || meta("application-name") || fromTitle || base.hostname.replace(/^www\./, ""));
  const abs = (href) => {
    try {
      return new URL(href, base).href;
    } catch {
      return "";
    }
  };
  const size = (s) => Math.max(0, ...(s ?? "").split(/\s+/).map((x) => parseInt(x, 10) || 0));
  const icons = links.filter((l) => /(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/i.test(l.rel ?? "") && l.href && !/\.svg(\?|$)/i.test(l.href) && !/svg/i.test(l.type ?? "")).map((l) => ({ href: abs(l.href), score: size(l.sizes) + (/apple-touch-icon/i.test(l.rel) ? 180 : 0) - (/\.ico(\?|$)/i.test(l.href) ? 64 : 0) })).sort((a, b) => b.score - a.score).map((l) => l.href).filter(Boolean);
  const manifestHref = links.find((l) => /(^|\s)manifest(\s|$)/i.test(l.rel ?? ""))?.href;
  return { name, themeColor: hexColor(meta("theme-color") ?? meta("msapplication-tilecolor")), manifest: manifestHref ? abs(manifestHref) : "", icons };
}
function sniffImage(b) {
  if (b.length > 8 && b[0] === 137 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.length > 6 && b.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
function pngFromIco(b) {
  if (b.length < 6 || b.readUInt16LE(0) !== 0 || b.readUInt16LE(2) !== 1) return null;
  const n = Math.min(b.readUInt16LE(4), 64);
  let best = null;
  let bestSize = 0;
  for (let i = 0; i < n; i++) {
    const at = 6 + i * 16;
    if (at + 16 > b.length) break;
    const size = (b[at] || 256) * (b[at + 1] || 256);
    const len = b.readUInt32LE(at + 8);
    const off = b.readUInt32LE(at + 12);
    if (off + len > b.length || len < 8) continue;
    const data = b.subarray(off, off + len);
    if (sniffImage(data) === "image/png" && size > bestSize) {
      best = data;
      bestSize = size;
    }
  }
  return best;
}
var hostMatches = (host, blocked) => blocked.some((b) => {
  const d = b.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  return d && (host === d || host.endsWith(`.${d}`));
});
function siteUrl(input) {
  const s = input.trim().slice(0, 300);
  if (!s) throw new Error("Type a website.");
  return checkUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`);
}
async function fetchBrand(input, opts = {}) {
  const o = { maxBytes: opts.maxPageBytes ?? 512 * 1024, timeoutMs: opts.timeoutMs ?? 6e3, accept: "text/html,application/xhtml+xml", userAgent: opts.userAgent ?? "QuestPassBooth/1 (brand lookup; +https://github.com/simarpreetsingh-019/questpass-booth)" };
  const start = siteUrl(input);
  const blocked = opts.blocked ?? [];
  const host = (u) => u.hostname.toLowerCase().replace(/^www\./, "");
  if (hostMatches(host(start), blocked)) throw new BrandBlockedError(host(start));
  const page = await safeGet(start, o);
  if (hostMatches(host(page.url), blocked)) throw new BrandBlockedError(host(page.url));
  if (page.status >= 400) throw new Error(`The site answered ${page.status}.`);
  const info = readPage(page.body.toString("utf8"), page.url);
  let name = info.name;
  let themeColor = info.themeColor;
  const candidates = [...info.icons];
  if (info.manifest) {
    try {
      const m = await safeGet(info.manifest, { ...o, maxBytes: 100 * 1024, accept: "application/manifest+json,application/json" });
      const j = JSON.parse(m.body.toString("utf8"));
      if (!name && typeof j.short_name === "string") name = cleanName(j.short_name);
      if (!themeColor && typeof j.theme_color === "string") themeColor = hexColor(j.theme_color);
      const icons = (Array.isArray(j.icons) ? j.icons : []).filter((i) => typeof i.src === "string" && !/svg/i.test(String(i.type ?? "")) && !/\.svg(\?|$)/i.test(String(i.src))).map((i) => ({ src: new URL(String(i.src), m.url).href, size: Math.max(0, ...String(i.sizes ?? "").split(/\s+/).map((x) => parseInt(x, 10) || 0)) })).sort((a, b) => b.size - a.size);
      candidates.unshift(...icons.filter((i) => i.size >= 128).map((i) => i.src));
      candidates.push(...icons.filter((i) => i.size < 128).map((i) => i.src));
    } catch {
    }
  }
  candidates.push(new URL("/apple-touch-icon.png", page.url).href);
  let logo = "";
  for (const src of [...new Set(candidates)].slice(0, 6)) {
    try {
      const max = opts.maxLogoBytes ?? 1024 * 1024;
      const img = await safeGet(src, { ...o, maxBytes: max, accept: "image/png,image/webp,image/jpeg,image/gif,image/x-icon" });
      if (img.status >= 400 || img.body.length >= max) continue;
      const body = sniffImage(img.body) ? img.body : pngFromIco(img.body);
      const type = body ? sniffImage(body) : null;
      if (!body || !type || body.length < 200) continue;
      logo = `data:${type};base64,${body.toString("base64")}`;
      break;
    } catch {
    }
  }
  return { name: name || host(page.url), website: `${page.url.protocol}//${page.url.host}`, logo, themeColor };
}

// server/avatar.ts
var AvatarNotFoundError = class extends Error {
  constructor(msg) {
    super(msg);
    this.name = "AvatarNotFoundError";
  }
};
var USERNAME = /^[A-Za-z0-9_]{1,32}$/;
var TELEGRAM_IMAGES = /(^|\.)(telesco\.pe|telegram\.org|cdn-telegram\.org)$/;
var X_IMAGES = /^pbs\.twimg\.com$/;
async function image(url, hosts, o) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !hosts.test(u.hostname)) throw new AvatarNotFoundError("unexpected picture host");
  const max = 1024 * 1024;
  const r = await safeGet(u, { ...o, maxBytes: max, accept: "image/jpeg,image/png,image/webp" });
  const type = r.status < 400 && r.body.length < max ? sniffImage(r.body) : null;
  if (!type) throw new AvatarNotFoundError("no picture");
  return `data:${type};base64,${r.body.toString("base64")}`;
}
async function fetchAvatar(network, username, opts = {}) {
  const o = { maxBytes: 256 * 1024, timeoutMs: opts.timeoutMs ?? 6e3, accept: "text/html", userAgent: opts.userAgent ?? "Mozilla/5.0 (compatible; QuestPassBooth/1; profile picture)" };
  const name = username.replace(/^@/, "");
  if (!USERNAME.test(name)) throw new AvatarNotFoundError("That isn't a username.");
  if (network === "telegram") {
    for (const host of ["t.me", "telegram.me"]) {
      try {
        const page = await safeGet(`https://${host}/${name}`, o);
        const og = tags(page.body.toString("utf8"), "meta").find((m) => (m.property ?? "").toLowerCase() === "og:image")?.content ?? "";
        if (!og || /telegram\.org\/img\/t_logo/.test(og)) throw new AvatarNotFoundError("No public Telegram profile picture for that username.");
        return await image(og, TELEGRAM_IMAGES, o);
      } catch (e) {
        if (e instanceof AvatarNotFoundError || e instanceof BlockedAddressError) throw e;
      }
    }
    throw new AvatarNotFoundError("Telegram didn't answer.");
  }
  if (network === "x") {
    if (!opts.x) throw new AvatarNotFoundError("X pictures aren't switched on here. Upload one instead.");
    const r = await safeGet(`https://api.fxtwitter.com/${name}`, { ...o, accept: "application/json" });
    let url = "";
    try {
      url = String(JSON.parse(r.body.toString("utf8")).user?.avatar_url ?? "");
    } catch {
      url = "";
    }
    if (!url) throw new AvatarNotFoundError("No X profile picture for that username.");
    return image(url.replace(/_normal(\.\w+)$/, "_400x400$1"), X_IMAGES, o);
  }
  throw new AvatarNotFoundError("Pictures can be looked up for Telegram and X. Upload one instead.");
}

// server/index.ts
var hits = /* @__PURE__ */ new Map();
function limited(key, perHour) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 36e5);
  if (recent.length >= perHour) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 1e4) hits.clear();
  return false;
}
function endpoint(opts, what, run) {
  const allow = new Set(opts.allowOrigins ?? []);
  return async function handle(req) {
    const origin = req.headers.get("origin");
    const cors = origin && allow.has(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
    const json = (status2, body2) => new Response(JSON.stringify(body2), { status: status2, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...cors } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET", "access-control-max-age": "600" } });
    if (req.method !== "GET") return json(405, { error: "GET only" });
    if (origin && !allow.has(origin) && origin !== new URL(req.url).origin) return json(403, { error: `This site may not use the ${what}.` });
    const caller = opts.callerOf?.(req) ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    if (limited(`${what}|${caller}`, opts.perHour ?? 30)) return json(429, { error: "Too many lookups. Try again in a while." });
    const [status, body] = await run(new URL(req.url).searchParams);
    return json(status, body);
  };
}
var brands = /* @__PURE__ */ new Map();
function createBrandHandler(opts = {}) {
  return endpoint(opts, "brand lookup", async (q) => {
    const input = q.get("url") ?? "";
    if (!input.trim() || input.length > 300) return [400, { error: "Add ?url=<website>." }];
    const key = input.trim().toLowerCase();
    const hit = brands.get(key);
    if (hit && Date.now() - hit.at < 36e5) return [200, hit.kit];
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
function createAvatarHandler(opts = {}) {
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
function nodeBrandHandler(opts = {}) {
  return toNode((callerOf) => createBrandHandler({ ...opts, callerOf: opts.callerOf ?? callerOf }));
}
function nodeAvatarHandler(opts = {}) {
  return toNode((callerOf) => createAvatarHandler({ ...opts, callerOf: opts.callerOf ?? callerOf }));
}
function toNode(make) {
  const SOCKET = "x-questpass-booth-peer";
  const handle = make((r) => r.headers.get(SOCKET) ?? "anon");
  return async (req, res) => {
    const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    headers.set(SOCKET, req.socket.remoteAddress ?? "anon");
    const r = await handle(new Request(url, { method: req.method, headers }));
    res.statusCode = r.status;
    r.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await r.arrayBuffer()));
  };
}
export {
  AvatarNotFoundError,
  BlockedAddressError,
  BrandBlockedError,
  checkUrl,
  createAvatarHandler,
  createBrandHandler,
  fetchAvatar,
  fetchBrand,
  isPublicAddress,
  nodeAvatarHandler,
  nodeBrandHandler,
  pngFromIco,
  readPage,
  siteUrl,
  sniffImage
};
//# sourceMappingURL=server.js.map
