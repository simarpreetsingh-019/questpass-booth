/**
 * Brand from a website: type "pizzadao.org" and get the brand's name, its
 * logo (as a data URL the booth's canvas can use) and its theme colour, read
 * from the site's public <head> and web manifest, the same way a link
 * preview is made. Runs on your server (browsers can't read other sites).
 *
 * Use it only for brands that agreed to be on your booth: the result is a
 * starting point the person setting up the booth checks and edits. A brand
 * owner can ask you to block their site (`blocked`).
 */
import { checkUrl, safeGet, type GetOptions } from "./net";

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

export class BrandBlockedError extends Error {
  constructor(host: string) {
    super(`${host} is blocked`);
    this.name = "BrandBlockedError";
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m),
  );

/** The attributes of each <meta>/<link> tag in `html`. */
export function tags(html: string, name: "meta" | "link"): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  for (const m of html.matchAll(re)) {
    const attrs: Record<string, string> = {};
    for (const a of m[1]!.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[a[1]!.toLowerCase()] = decode(a[3] ?? a[4] ?? a[5] ?? "").trim();
    }
    out.push(attrs);
  }
  return out;
}

const hexColor = (v: string | undefined): string => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((v ?? "").trim());
  if (!m) return "";
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return `#${h.toUpperCase()}`;
};

const cleanName = (s: string) => decode(s).replace(/\s+/g, " ").trim().slice(0, 40);

export interface PageInfo {
  name: string;
  themeColor: string;
  manifest: string;
  /** logo candidates, best first */
  icons: string[];
}

/** What the page's <head> says about the brand. `base` resolves relative links. */
export function readPage(html: string, base: URL): PageInfo {
  const end = html.search(/<\/head>/i);
  const head = end >= 0 ? html.slice(0, end) : html;
  const metas = tags(head, "meta");
  const links = tags(head, "link");
  const meta = (key: string) => metas.find((m) => (m.property ?? m.name ?? "").toLowerCase() === key)?.content;
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ?? "";
  // "PizzaDAO | Pizza for everyone" → "PizzaDAO"
  const fromTitle = decode(title).split(/\s+[|·•–—-]\s+|:\s+/)[0] ?? "";
  const name = cleanName(meta("og:site_name") || meta("application-name") || fromTitle || base.hostname.replace(/^www\./, ""));
  const abs = (href: string) => {
    try {
      return new URL(href, base).href;
    } catch {
      return "";
    }
  };
  const size = (s: string | undefined) => Math.max(0, ...(s ?? "").split(/\s+/).map((x) => parseInt(x, 10) || 0));
  const icons = links
    .filter((l) => /(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/i.test(l.rel ?? "") && l.href && !/\.svg(\?|$)/i.test(l.href) && !/svg/i.test(l.type ?? ""))
    .map((l) => ({ href: abs(l.href!), score: size(l.sizes) + (/apple-touch-icon/i.test(l.rel!) ? 180 : 0) - (/\.ico(\?|$)/i.test(l.href!) ? 64 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((l) => l.href)
    .filter(Boolean);
  const manifestHref = links.find((l) => /(^|\s)manifest(\s|$)/i.test(l.rel ?? ""))?.href;
  return { name, themeColor: hexColor(meta("theme-color") ?? meta("msapplication-tilecolor")), manifest: manifestHref ? abs(manifestHref) : "", icons };
}

/** The picture type from its first bytes (never trust the server's word for it). */
export function sniffImage(b: Buffer): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null {
  if (b.length > 8 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 6 && b.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * The biggest PNG inside a .ico file (modern favicons store their large
 * sizes as PNG), or null. Only PNG entries are taken, so nothing needs
 * decoding here.
 */
export function pngFromIco(b: Buffer): Buffer | null {
  if (b.length < 6 || b.readUInt16LE(0) !== 0 || b.readUInt16LE(2) !== 1) return null;
  const n = Math.min(b.readUInt16LE(4), 64);
  let best: Buffer | null = null;
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

const hostMatches = (host: string, blocked: string[]) =>
  blocked.some((b) => {
    const d = b.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    return d && (host === d || host.endsWith(`.${d}`));
  });

/** "pizzadao.org", "https://pizzadao.org/about" → a checked https URL to start from. */
export function siteUrl(input: string): URL {
  const s = input.trim().slice(0, 300);
  if (!s) throw new Error("Type a website.");
  return checkUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`);
}

export async function fetchBrand(input: string, opts: BrandOptions = {}): Promise<BrandKit> {
  const o: GetOptions = { maxBytes: opts.maxPageBytes ?? 512 * 1024, timeoutMs: opts.timeoutMs ?? 6000, accept: "text/html,application/xhtml+xml", userAgent: opts.userAgent ?? "QuestPassBooth/1 (brand lookup; +https://github.com/simarpreetsingh-019/questpass-booth)" };
  const start = siteUrl(input);
  const blocked = opts.blocked ?? [];
  const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
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
      const j = JSON.parse(m.body.toString("utf8")) as { name?: unknown; short_name?: unknown; theme_color?: unknown; icons?: Array<{ src?: unknown; sizes?: unknown; type?: unknown }> };
      if (!name && typeof j.short_name === "string") name = cleanName(j.short_name);
      if (!themeColor && typeof j.theme_color === "string") themeColor = hexColor(j.theme_color);
      const icons = (Array.isArray(j.icons) ? j.icons : [])
        .filter((i) => typeof i.src === "string" && !/svg/i.test(String(i.type ?? "")) && !/\.svg(\?|$)/i.test(String(i.src)))
        .map((i) => ({ src: new URL(String(i.src), m.url).href, size: Math.max(0, ...String(i.sizes ?? "").split(/\s+/).map((x) => parseInt(x, 10) || 0)) }))
        .sort((a, b) => b.size - a.size);
      candidates.unshift(...icons.filter((i) => i.size >= 128).map((i) => i.src));
      candidates.push(...icons.filter((i) => i.size < 128).map((i) => i.src));
    } catch {
      // no manifest, or not one we can read: the page's own icons will do
    }
  }
  candidates.push(new URL("/apple-touch-icon.png", page.url).href);

  let logo = "";
  for (const src of [...new Set(candidates)].slice(0, 6)) {
    try {
      const max = opts.maxLogoBytes ?? 1024 * 1024;
      const img = await safeGet(src, { ...o, maxBytes: max, accept: "image/png,image/webp,image/jpeg,image/gif,image/x-icon" });
      if (img.status >= 400 || img.body.length >= max) continue;
      // a .ico: its biggest PNG, if it has one
      const body = sniffImage(img.body) ? img.body : pngFromIco(img.body);
      const type = body ? sniffImage(body) : null;
      // too small to be a logo
      if (!body || !type || body.length < 200) continue;
      logo = `data:${type};base64,${body.toString("base64")}`;
      break;
    } catch {
      // try the next one
    }
  }
  return { name: name || host(page.url), website: `${page.url.protocol}//${page.url.host}`, logo, themeColor };
}
