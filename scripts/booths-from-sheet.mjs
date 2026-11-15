#!/usr/bin/env node
/**
 * One booth per row of a spreadsheet: each row (a city, a party) becomes a
 * page with its own link, plus an index page with every link and a QR code
 * to print for each venue. Edit the sheet, run this again (or let the
 * GitHub Action do it), and every booth updates.
 *
 *   node scripts/booths-from-sheet.mjs \
 *     --sheet "https://docs.google.com/spreadsheets/d/e/…/pub?output=csv" \
 *     --base presets/pizzadao.json \
 *     --names "https://docs.google.com/…/pub?gid=…&output=csv" \
 *     --base-url https://pizzadao.github.io/booths \
 *     --out _site
 *
 * --sheet and --names take a published CSV link (Google Sheets: File →
 * Share → Publish to web → CSV) or a local .csv file. See docs/spreadsheet.md
 * for the columns.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { listWordSlots, normalizeConfig, VERSION } from "../dist/config.js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((out, a, i, all) => (a.startsWith("--") ? [...out, [a.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1]]] : out), []),
);
if (!args.sheet) {
  console.error("Usage: node scripts/booths-from-sheet.mjs --sheet <csv link or file> [--base presets/pizzadao.json] [--names <csv>] [--base-url https://…] [--out _site] [--script <booth script URL>]");
  process.exit(1);
}
const out = args.out ?? "_site";
const baseUrl = (args["base-url"] ?? "").replace(/\/+$/, "");
const script = args.script ?? `https://cdn.jsdelivr.net/gh/simarpreetsingh-019/questpass-booth@${VERSION.split(".")[0]}/dist/questpass-booth.js`;

/** A CSV file or link → rows of { column: value } (header names lower-cased). */
async function readCsv(src) {
  let textIn;
  if (/^https:\/\//.test(src)) {
    const r = await fetch(src, { redirect: "follow" });
    if (!r.ok) throw new Error(`${src} answered ${r.status}`);
    textIn = await r.text();
  } else textIn = readFileSync(src, "utf8");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < textIn.length; i++) {
    const c = textIn[i];
    if (quoted) {
      if (c === '"' && textIn[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && textIn[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const yes = (v) => /^(y|yes|true|1|on)$/i.test(v);
const list = (v) => v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slotIds = new Set(listWordSlots().map((s) => s.id));
const slotMax = new Map(listWordSlots().map((s) => [s.id, s.max]));

/** A row's settings on top of the base config. */
function configFor(row, base, names, warn, fallbackLink) {
  const c = structuredClone(base);
  c.brand ??= {};
  c.brand.colors ??= {};
  c.frames ??= {};
  c.share ??= {};
  c.person ??= {};
  c.video ??= {};
  for (const [k, v] of Object.entries(row)) {
    if (!v) continue;
    if (k === "slug") continue;
    else if (k === "title" || k === "place" || k === "dates") c[k] = v;
    else if (k === "link") c.share.link = v;
    else if (k === "share_text") c.share.text = v;
    else if (["accent", "highlight", "base", "text"].includes(k)) {
      const hex = v.startsWith("#") ? v : `#${v}`;
      if (/^#[0-9a-f]{6}$/i.test(hex)) c.brand.colors[k] = hex;
      else warn(`${k} "${v}" isn't a #RRGGBB colour: kept ${c.brand.colors[k] ?? "the default"}`);
    }
    else if (k === "brand" || k === "brand_name") c.brand.name = v;
    else if (k === "website") c.brand.website = v;
    else if (k === "logo") c.brand.logo = v;
    else if (k === "default_frame") c.frames.default = v;
    else if (k === "frames") c.frames.allow = v === "all" ? "all" : list(v);
    else if (k === "first_frames") c.frames.first = list(v);
    else if (k === "packs") c.packs = list(v);
    else if (k === "name_label") c.person.nameLabel = v;
    else if (k === "line_label") c.person.lineLabel = v;
    else if (k === "credit") warn(`the credit can't be turned off: column "credit" ignored`);
    else if (k === "video") c.video.enabled = yes(v);
    else if (k.startsWith("words.")) {
      const id = k.slice(6);
      if (!slotIds.has(id)) warn(`unknown text space "${id}"`);
      // "off", "edit: starting text", or just the words (fixed)
      const m = /^(off|edit|fixed)\s*:?\s*(.*)$/i.exec(v);
      c.words ??= {};
      c.words[id] = m && (m[1].toLowerCase() !== "fixed" || v.includes(":")) ? { mode: m[1].toLowerCase(), text: m[2] } : { mode: "fixed", text: v };
      const max = slotMax.get(id);
      if (max && c.words[id].text.length > max) warn(`${k} is ${c.words[id].text.length} characters; that space fits ${max}: it will be cut`);
    } else warn(`column "${k}" isn't used`);
  }
  if (names.length) c.person.names = names;
  const clean = normalizeConfig(c);
  // say what the checks changed, so a typo in the sheet doesn't pass silently
  if (c.frames.default && c.frames.default !== clean.frames.default) warn(`frame "${c.frames.default}" isn't offered: opening with ${clean.frames.default}`);
  if (c.share.link && !clean.share.link) {
    warn(`link "${c.share.link}" isn't https: ${fallbackLink ? "using the booth's own page" : "left out"}`);
    if (fallbackLink) clean.share.link = fallbackLink;
  }
  if (c.brand.logo && !clean.brand.logo) warn(`logo isn't an https or PNG/JPEG/WebP/GIF image: left out`);
  return clean;
}

function boothPage(c, url) {
  const origin = new URL(script).origin;
  const desc = [c.place, c.dates].filter(Boolean).join(" · ") || "Take a photo, frame it, share it.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${origin}; connect-src 'self' https:; font-src ${origin}; img-src 'self' data: blob: https:; media-src blob:; style-src 'self' 'unsafe-inline'" />
  <meta name="referrer" content="no-referrer" />
  <title>${esc(c.title)} · photo booth</title>
  <meta name="description" content="${esc(desc)}" />
  <meta property="og:title" content="${esc(c.title)} · photo booth" />
  <meta property="og:description" content="${esc(desc)}" />
  ${url ? `<meta property="og:url" content="${esc(url)}" />` : ""}
  <meta name="theme-color" content="${esc(c.brand.colors.base)}" />
  <style>html,body{margin:0;background:${esc(c.brand.colors.base)}}questpass-booth{border-radius:0;min-height:100vh}</style>
  <script type="module" src="${esc(script)}"></script>
</head>
<body>
  <questpass-booth config-src="booth.json"></questpass-booth>
</body>
</html>
`;
}

function indexPage(booths) {
  const cards = booths
    .map((b) => `<li><div class="qr">${b.qr}</div><div><h2>${esc(b.title)}</h2><p>${esc([b.place, b.dates].filter(Boolean).join(" · "))}</p><a href="${esc(b.href)}">${esc(b.url || b.href)}</a></div></li>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Photo booths</title>
  <style>
    body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#fff;color:#111}
    main{max-width:960px;margin:0 auto;padding:16px}
    ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
    li{display:flex;gap:12px;align-items:center;border:1px solid #ddd;border-radius:12px;padding:12px;break-inside:avoid}
    .qr svg{width:110px;height:110px;display:block}
    h2{margin:0;font-size:17px} p{margin:2px 0 6px;color:#555} a{color:#b3261e;word-break:break-all}
    @media print{li{border-color:#999}}
  </style>
</head>
<body>
  <main>
    <h1>Photo booths (${booths.length})</h1>
    <p>Print a QR code for each venue. Updated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.</p>
    <ul>
${cards}
    </ul>
  </main>
</body>
</html>
`;
}

if (!baseUrl) console.warn("No --base-url: the QR codes and share links will be relative. Pass the address the booths will live at.");
const base = args.base ? JSON.parse(readFileSync(args.base, "utf8")) : {};
const rows = await readCsv(args.sheet);
const nameRows = args.names ? await readCsv(args.names) : [];
let problems = 0;
const seen = new Set();
const booths = [];

for (const [i, row] of rows.entries()) {
  const slug = slugify(row.slug || row.place || row.title || "");
  const warn = (msg) => (problems++, console.warn(`row ${i + 2} (${slug || "?"}): ${msg}`));
  if (!slug) {
    warn("needs a slug, place or title: skipped");
    continue;
  }
  if (seen.has(slug)) {
    warn(`"${slug}" is used twice: skipped the second`);
    continue;
  }
  seen.add(slug);
  // names for every booth, or only for the booths listed in their "booth" column
  const names = nameRows.filter((n) => n.name && (!n.booth || list(n.booth).map(slugify).includes(slug))).map((n) => n.name);
  const url = baseUrl ? `${baseUrl}/${slug}/` : "";
  if (url && !row.link) row.link = url;
  const c = configFor(row, base, names, warn, url);
  mkdirSync(join(out, slug), { recursive: true });
  writeFileSync(join(out, slug, "booth.json"), JSON.stringify(c));
  writeFileSync(join(out, slug, "index.html"), boothPage(c, url));
  const qr = await QRCode.toString(url || `${slug}/`, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  booths.push({ slug, title: c.title, place: c.place, dates: c.dates, url, href: `${slug}/`, qr });
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "index.html"), indexPage(booths));
writeFileSync(join(out, "booths.json"), JSON.stringify(booths.map(({ qr, ...b }) => b), null, 2));
console.log(`${booths.length} booth${booths.length === 1 ? "" : "s"} written to ${out}/${problems ? ` (${problems} note${problems === 1 ? "" : "s"} above)` : ""}`);
