/*! QuestPass Booth 1.0.0 | Apache-2.0 | (c) Simarpreet Singh | https://github.com/simarpreetsingh-019/questpass-booth */

// src/shims/sponsors.ts
var DEFAULT_THEME = {
  accent: "#38FF9C",
  accentDark: "#2A9660",
  accentSoft: "#C9F7DF",
  highlight: "#FFC440",
  highlight2: "#FF8A28",
  base: "#0E0E0E",
  surface: "#1A1A1A",
  surface2: "#141414",
  text: "#F5F5F0"
};
var active = {
  id: "questpass-booth",
  name: "QuestPass Booth",
  url: "",
  wordmark: { src: "", width: 120, height: 40, alt: "QuestPass Booth" },
  logo: { width: 120, height: 40, mark: [], word: [], markColor: DEFAULT_THEME.accent, wordColor: DEFAULT_THEME.text },
  theme: DEFAULT_THEME,
  copy: { presentedBy: "Presented by", poweredBy: "by", posterNote: "" },
  ownedSlots: [],
  ticketPrefix: "QP"
};
var pageSponsor = () => active;

// src/shims/theme.ts
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return `${n >> 16 & 255} ${n >> 8 & 255} ${n & 255}`;
}
function rgba(hex, a) {
  return `rgba(${hexToRgb(hex).replace(/ /g, ",")},${a})`;
}
function mix(a, b, t) {
  const pa = hexToRgb(a).split(" ").map(Number);
  const pb = hexToRgb(b).split(" ").map(Number);
  return `#${pa.map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, "0")).join("")}`;
}
var mutedText = (t, amount = 0.45) => mix(t.text, t.base, amount);

// src/engine/upstream/draw-kit.ts
var FRAME_MS = 80;
var FPS = 1e3 / FRAME_MS;
var palette = (T) => ({
  bg: T.base,
  panel: T.surface,
  darkGreen: T.accentDark,
  mint: T.accentSoft,
  /** Muted text: the text colour pulled 45% toward the background. */
  grey: mutedText(T),
  /** Map land: the accent mixed deep into the background. */
  land: mix(T.base, T.accent, 0.1),
  neon: T.accent,
  gold: T.highlight,
  marigold: T.highlight2,
  /** Sea on the Mumbai map: the accent, lightened toward the text colour. */
  sea: mix(T.accent, T.text, 0.3),
  shadow: "#000000",
  white: T.text,
  dim: rgba(T.text, 0.6),
  faint: rgba(T.text, 0.22)
});
var C = palette(pageSponsor().theme);
var F = {
  display: (px, w = 900) => `${w} ${px}px Cinzel, Georgia, serif`,
  mono: (px, w = 500) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`,
  sans: (px, w = 600) => `${w} ${px}px Inter, system-ui, sans-serif`
};
var clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
function text(ctx, s, x, y, font, color2, align = "center") {
  ctx.font = font;
  ctx.fillStyle = color2;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}
var pathCache = /* @__PURE__ */ new Map();
var imageCache = /* @__PURE__ */ new Map();
function drawSponsorLogo(ctx, sponsor, x, y, height) {
  if (sponsor.logo.mark.length + sponsor.logo.word.length === 0) {
    const img = sponsor.logoImage ? imageCache.get(sponsor.logoImage) : void 0;
    if (img) {
      const w = (img.naturalWidth || sponsor.logo.width) / (img.naturalHeight || sponsor.logo.height) * height;
      ctx.drawImage(img, x, y, w, height);
      return w;
    }
    const font = F.sans(Math.round(height * 0.7), 800);
    text(ctx, sponsor.name, x, y + height / 2, font, sponsor.theme.text, "left");
    ctx.font = font;
    return ctx.measureText(sponsor.name).width;
  }
  let p = pathCache.get(sponsor.id);
  if (!p) {
    p = { mark: sponsor.logo.mark.map((d) => new Path2D(d)), word: sponsor.logo.word.map((d) => new Path2D(d)) };
    pathCache.set(sponsor.id, p);
  }
  const k = height / sponsor.logo.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = sponsor.logo.markColor;
  for (const path of p.mark) ctx.fill(path);
  ctx.fillStyle = sponsor.logo.wordColor;
  for (const path of p.word) ctx.fill(path);
  ctx.restore();
  return sponsor.logo.width * k;
}

// src/engine/upstream/frames.ts
import QRCode from "qrcode";

// src/core/fonts.ts
var FONT_FILES = [
  ...["400", "500", "600", "700", "800", "900"].map((w) => ["Inter", `inter-latin-${w}-normal.woff2`, w, "normal"]),
  ["Inter", "inter-latin-900-italic.woff2", "900", "italic"],
  ...["500", "600", "700"].map((w) => ["IBM Plex Mono", `ibm-plex-mono-latin-${w}-normal.woff2`, w, "normal"]),
  ...["700", "900"].map((w) => ["Cinzel", `cinzel-latin-${w}-normal.woff2`, w, "normal"]),
  ["Caveat", "caveat-latin-700-normal.woff2", "700", "normal"],
  ["Permanent Marker", "permanent-marker-latin-400-normal.woff2", "400", "normal"],
  ["Playfair Display", "playfair-display-latin-800-italic.woff2", "800", "italic"],
  ["Bebas Neue", "bebas-neue-latin-400-normal.woff2", "400", "normal"],
  // the booth's own headings, when the config asks for the condensed look
  ["Asap Condensed", "asap-condensed-latin-800-normal.woff2", "800", "normal"]
];

// src/engine/upstream/reel.ts
var ROLE_LOOK = {
  Developer: { emoji: "\u{1F4BB}", color: "#4ADE80" },
  "Content creator": { emoji: "\u{1F3AC}", color: "#F472B6" },
  Marketing: { emoji: "\u{1F4E3}", color: "#FB923C" },
  Business: { emoji: "\u{1F4BC}", color: "#60A5FA" },
  Founder: { emoji: "\u{1F680}", color: "#FACC15" },
  GTM: { emoji: "\u{1F3AF}", color: "#A78BFA" }
};
function roundRect(ctx, r, rad) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
}
function wrap(ctx, s, maxW, lines = 2) {
  const out = [];
  let cur = "";
  for (const word2 of s.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word2}` : word2;
    if (ctx.measureText(next).width > maxW && cur) {
      out.push(cur);
      cur = word2;
      if (out.length === lines) break;
    } else cur = next;
  }
  if (out.length < lines && cur) out.push(cur);
  return out.slice(0, lines);
}
var wholeNames = false;
var firstName = (n) => wholeNames ? n.trim() : n.trim().split(/\s+/)[0] ?? n;

// src/engine/upstream/frames.ts
var easeOutK = (x) => 1 - Math.pow(1 - x, 3);
var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
var P = (name, bg, fg, muted, paper, ink, accent, accent2) => ({ name, bg, fg, muted, paper, ink, accent, accent2 });
var hexRgb = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [v >> 16 & 255, v >> 8 & 255, v & 255];
};
var rgbHex = (r, g, b) => `#${[r, g, b].map((x) => Math.round(clamp(x / 255) * 255).toString(16).padStart(2, "0")).join("")}`;
function withA(c, a) {
  const v = hexRgb(c);
  return v ? `rgba(${v[0]},${v[1]},${v[2]},${a})` : c;
}
function mix2(a, b, k) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  if (!x || !y) return a;
  return rgbHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
}
function lightness(c) {
  const v = hexRgb(c);
  return v ? (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 : 0.5;
}
var onColor = (c) => lightness(c) > 0.6 ? "#111111" : "#FFFFFF";
var CREDIT = "made by @simarpreet_019";
var wordOf = (f, id) => f.words?.[id];
var placeOf = (f) => f.brand ? f.brand.place : "Mumbai";
var markOf = (f) => f.brand ? f.brand.mark : "QuestPass";
var creditOf = (f) => f.brand ? f.brand.credit : CREDIT;
var signOf = (f) => [markOf(f).toUpperCase(), creditOf(f)].filter(Boolean).join(" \xB7 ");
var code3 = (s) => s.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "---";
function routeFor(f, fromId = "pass.from") {
  if (!f.brand) return { fromCode: f.journey.code, from: f.journey.city.toUpperCase(), toCode: "BOM", to: "MUMBAI" };
  const from = (wordOf(f, fromId) ?? "Home") || "Home";
  const to = (wordOf(f, "pass.to") ?? f.eventName) || "The party";
  return { fromCode: code3(from), from: from.toUpperCase(), toCode: code3(to), to: to.toUpperCase() };
}
var ticketOf = (f) => f.brand ? `${code3(f.eventName || "SNAP")}-${(firstName(f.journey.name) || "GUEST").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}-0001` : f.journey.ticket;
var titleAt = (f) => [f.eventName, placeOf(f)].filter(Boolean).join(" \xB7 ");
var banded = (top, bottom, side) => (W, H, u) => {
  const sx = (W > 1.3 * H ? side * 0.35 : side) * u;
  return { x: sx, y: top * u, w: W - sx * 2, h: H - (top + bottom) * u };
};
var capped = (top, bottom, side, maxAspect) => (W, H, u) => {
  const r = banded(top, bottom, side)(W, H, u);
  const w = Math.min(r.w, r.h * (W > 1.3 * H ? Math.max(maxAspect * 1.25, 1.8) : maxAspect));
  return { ...r, x: (W - w) / 2, w };
};
var lum = (d) => {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 128) continue;
    sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    n++;
  }
  return n ? sum / n : null;
};
var logoLum = /* @__PURE__ */ new Map();
var snap = null;
function areaLum(ctx, x, y, w, h) {
  if (!snap) {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 8;
    snap = c.getContext("2d", { willReadFrequently: true });
  }
  if (!snap) return null;
  snap.clearRect(0, 0, 32, 8);
  snap.drawImage(ctx.canvas, x, y, Math.max(1, w), Math.max(1, h), 0, 0, 32, 8);
  return lum(snap.getImageData(0, 0, 32, 8).data);
}
function sponsorLogo(ctx, sponsor, x, y, h) {
  const probe = document.createElement("canvas");
  const w = Math.ceil(drawSponsorLogo(probe.getContext("2d"), sponsor, 0, 0, h));
  if (w <= 0) return 0;
  let lg = logoLum.get(sponsor.id);
  if (lg === void 0) {
    probe.width = w;
    probe.height = Math.ceil(h);
    const pc = probe.getContext("2d", { willReadFrequently: true });
    drawSponsorLogo(pc, sponsor, 0, 0, h);
    try {
      lg = lum(pc.getImageData(0, 0, probe.width, probe.height).data);
    } catch {
      lg = null;
    }
    if (lg !== null) logoLum.set(sponsor.id, lg);
  }
  if (lg != null) {
    let bg = null;
    try {
      const t = ctx.getTransform();
      bg = areaLum(ctx, Math.round(t.a * x + t.e), Math.round(t.d * y + t.f), Math.round(w * t.a), Math.round(h * t.d));
    } catch {
      bg = null;
    }
    if (bg !== null && Math.abs(lg - bg) < 0.3) {
      const pad = h * 0.25;
      ctx.save();
      ctx.fillStyle = lg < 0.5 ? "rgba(245,243,236,0.92)" : "rgba(14,14,18,0.88)";
      roundRect(ctx, { x: x - pad, y: y - pad * 0.6, w: w + pad * 2, h: h + pad * 1.2 }, (h + pad * 1.2) / 2);
      ctx.fill();
      ctx.restore();
    }
  }
  drawSponsorLogo(ctx, sponsor, x, y, h);
  return w;
}
function dim(ctx, f, draw) {
  const a = 1 - (f.promo ?? 0);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  draw();
  ctx.restore();
}
function poweredBy(ctx, f, x, y, px, color2, align) {
  dim(ctx, f, () => poweredByNow(ctx, f, x, y, px, color2, align));
}
function poweredByNow(ctx, f, x, y, px, color2, align) {
  if (f.brand && !f.brand.sponsor) return;
  const words = `${f.sponsor.copy.poweredBy} `;
  ctx.font = F.sans(px, 500);
  const ww = ctx.measureText(words).width;
  const lh = px * 1.5;
  const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d"), f.sponsor, 0, 0, lh);
  const x0 = align === "center" ? x - (ww + lw) / 2 : align === "right" ? x - ww - lw : x;
  text(ctx, words, x0, y, F.sans(px, 500), color2, "left");
  sponsorLogo(ctx, f.sponsor, x0 + ww, y - lh / 2, lh);
}
function bands(ctx, f, ink, accent, muted, top = f.R.y, bottom = f.R.y + f.R.h) {
  const { u } = f;
  const mx = Math.max(f.R.x, 40 * u);
  text(ctx, f.eventName.toUpperCase(), mx, top / 2, F.mono(24 * u, 700), accent, "left");
  dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), f.W - mx, top / 2, F.mono(24 * u, 700), ink, "right"));
  const by = bottom + (f.H - bottom) / 2;
  poweredBy(ctx, f, mx, by, 22 * u, muted, "left");
  dim(ctx, f, () => text(ctx, creditOf(f), f.W - mx, by, F.mono(20 * u, 500), muted, "right"));
}
function ticketPath(ctx, c, rad, notch, nr) {
  const r = c.x + c.w;
  const b = c.y + c.h;
  ctx.beginPath();
  ctx.moveTo(c.x + rad, c.y);
  if (notch.x != null) {
    ctx.lineTo(notch.x - nr, c.y);
    ctx.arc(notch.x, c.y, nr, Math.PI, 0, true);
  }
  ctx.lineTo(r - rad, c.y);
  ctx.arcTo(r, c.y, r, c.y + rad, rad);
  if (notch.y != null) {
    ctx.lineTo(r, notch.y - nr);
    ctx.arc(r, notch.y, nr, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.lineTo(r, b - rad);
  ctx.arcTo(r, b, r - rad, b, rad);
  if (notch.x != null) {
    ctx.lineTo(notch.x + nr, b);
    ctx.arc(notch.x, b, nr, 0, Math.PI, true);
  }
  ctx.lineTo(c.x + rad, b);
  ctx.arcTo(c.x, b, c.x, b - rad, rad);
  if (notch.y != null) {
    ctx.lineTo(c.x, notch.y + nr);
    ctx.arc(c.x, notch.y, nr, Math.PI / 2, -Math.PI / 2, true);
  }
  ctx.lineTo(c.x, c.y + rad);
  ctx.arcTo(c.x, c.y, c.x + rad, c.y, rad);
  ctx.closePath();
}
function passLayout(W, H, u) {
  const wide2 = W >= H * 0.95;
  if (wide2) {
    const card2 = { x: 50 * u, y: 70 * u, w: W - 100 * u, h: H - 130 * u };
    const stubW = Math.min(440 * u, card2.w * 0.34);
    const tear2 = card2.x + card2.w - stubW;
    const R2 = { x: card2.x + 30 * u, y: card2.y + 200 * u, w: tear2 - card2.x - 60 * u, h: card2.h - 230 * u };
    return { wide: wide2, card: card2, tear: tear2, R: R2, head: { x: card2.x, y: card2.y, w: tear2 - card2.x, h: 200 * u }, stub: { x: tear2, y: card2.y, w: stubW, h: card2.h } };
  }
  const card = { x: 50 * u, y: 60 * u, w: W - 100 * u, h: H - 100 * u };
  const stubH = 300 * u;
  const tear = card.y + card.h - stubH;
  const R = { x: card.x + 30 * u, y: card.y + 270 * u, w: card.w - 60 * u, h: tear - card.y - 310 * u };
  return { wide: wide2, card, tear, R, head: { x: card.x, y: card.y, w: card.w, h: 270 * u }, stub: { x: card.x, y: tear, w: card.w, h: stubH } };
}
function barcode(ctx, seed, x, y, w, h, ink) {
  let v = 0;
  for (const ch of seed) v = v * 31 + ch.charCodeAt(0) >>> 0;
  ctx.fillStyle = ink;
  let cx = x;
  while (cx < x + w) {
    v = v * 1103515245 + 12345 >>> 0;
    const bw = 1 + v % 4;
    const unit = w / 180;
    if ((v >> 8) % 3 !== 0) ctx.fillRect(cx, y, bw * unit, h);
    cx += (bw + 1 + (v >> 4) % 2) * unit;
  }
}
var RARITY = {
  legendary: { name: "LEGENDARY", stars: "\u2605\u2605\u2605\u2605\u2605", base: ["#2B1650", "#0F0A22"], foil: ["#FF7AD9", "#FFE27A", "#7AF0FF", "#B07CFF"], accent: "#FFE27A" },
  epic: { name: "EPIC", stars: "\u2605\u2605\u2605\u2605", base: ["#2A1240", "#0E0A1C"], foil: ["#C77DFF", "#FF8AD8", "#9AE6FF", "#E9B8FF"], accent: "#E9B8FF" },
  rare: { name: "RARE", stars: "\u2605\u2605\u2605", base: ["#2E2208", "#120D04"], foil: ["#FFE08A", "#B8862B", "#FFF6D6", "#F2C94C"], accent: "#F2C94C" },
  uncommon: { name: "UNCOMMON", stars: "\u2605\u2605", base: ["#1E2530", "#0C1016"], foil: ["#E6EEF7", "#8DA2B8", "#FFFFFF", "#AFC3D6"], accent: "#DDE7F2" }
};
var rarityOf = (j) => RARITY[j.early ? "legendary" : j.traveller <= 100 ? "epic" : j.traveller <= 500 ? "rare" : "uncommon"];
var rarFor = (f) => {
  const own = rarityOf(f.journey);
  return f.pal.rarity ? { ...RARITY[f.pal.rarity], name: own.name, stars: own.stars } : own;
};
function gameLayout(W, H, u) {
  const wide2 = W >= H * 0.95;
  const card = wide2 ? { x: 60 * u, y: 70 * u, w: W - 120 * u, h: H - 140 * u } : { x: 60 * u, y: 90 * u, w: W - 120 * u, h: H - 150 * u };
  const m = 34 * u;
  if (wide2) {
    const pw = Math.min(480 * u, card.w * 0.36);
    const R2 = { x: card.x + m, y: card.y + m, w: card.w - m * 2 - pw - 16 * u, h: card.h - m * 2 };
    return { wide: wide2, card, R: R2, panel: { x: R2.x + R2.w + 16 * u, y: R2.y, w: pw, h: R2.h } };
  }
  const ph = 330 * u;
  const R = { x: card.x + m, y: card.y + m, w: card.w - m * 2, h: card.h - m * 2 - ph };
  return { wide: wide2, card, R, panel: { x: R.x, y: R.y + R.h + 16 * u, w: R.w, h: card.y + card.h - m - (R.y + R.h + 16 * u) } };
}
function chamfer(ctx, c, k) {
  ctx.beginPath();
  ctx.moveTo(c.x + k, c.y);
  ctx.lineTo(c.x + c.w - k, c.y);
  ctx.lineTo(c.x + c.w, c.y + k);
  ctx.lineTo(c.x + c.w, c.y + c.h - k);
  ctx.lineTo(c.x + c.w - k, c.y + c.h);
  ctx.lineTo(c.x + k, c.y + c.h);
  ctx.lineTo(c.x, c.y + c.h - k);
  ctx.lineTo(c.x, c.y + k);
  ctx.closePath();
}
function sparkle(ctx, x, y, r, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}
var PACK_FROM = 0.12;
var PACK_BURST = 1.2;
function chestOpening(ctx, f) {
  const { W, H, u, t } = f;
  if (t < PACK_FROM || t > 2.9) return;
  const rar = rarFor(f);
  const cx = W / 2;
  const cy = H / 2;
  const m = Math.min(W, H);
  const before = t < PACK_BURST;
  const cover = before ? 1 : 1 - clamp((t - PACK_BURST - 0.08) / 0.25);
  if (cover > 0) {
    ctx.save();
    ctx.globalAlpha = cover;
    ctx.fillStyle = "#07060D";
    ctx.fillRect(0, 0, W, H);
    const build = clamp((t - PACK_FROM) / (PACK_BURST - PACK_FROM));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.8);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = i % 2 ? `${rar.foil[1]}22` : `${rar.foil[0]}33`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-m * 0.08, -m);
      ctx.lineTo(m * 0.08, -m);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const glow2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * (0.35 + 0.15 * build));
    glow2.addColorStop(0, `${rar.accent}AA`);
    glow2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);
    const cw = m * 0.42;
    const ch = cw * 0.78;
    const shake = before ? Math.sin(t * 70) * build * build * 12 * u : 0;
    const bob = Math.sin(t * 5) * 6 * u;
    const x = cx - cw / 2 + shake;
    const bodyY = cy - ch * 0.1 + bob;
    const bodyH = ch * 0.6;
    const lidH = ch * 0.4;
    const gold = "#F2C94C";
    const purple = ctx.createLinearGradient(x, bodyY - lidH, x, bodyY + bodyH);
    purple.addColorStop(0, rar.foil[0]);
    purple.addColorStop(1, rar.base[0]);
    ctx.fillStyle = purple;
    ctx.beginPath();
    ctx.roundRect(x, bodyY, cw, bodyH, 10 * u);
    ctx.fill();
    ctx.lineWidth = 7 * u;
    ctx.strokeStyle = gold;
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(x + cw * 0.22, bodyY, cw * 0.07, bodyH);
    ctx.fillRect(x + cw * 0.71, bodyY, cw * 0.07, bodyH);
    const fly = before ? 0 : easeOutK(clamp((t - PACK_BURST) / 0.5));
    ctx.save();
    ctx.translate(x + cw / 2, bodyY - fly * m * 0.5);
    ctx.rotate(-fly * 0.9);
    ctx.fillStyle = purple;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, 0);
    ctx.lineTo(-cw / 2, -lidH * 0.45);
    ctx.quadraticCurveTo(-cw / 2, -lidH, 0, -lidH);
    ctx.quadraticCurveTo(cw / 2, -lidH, cw / 2, -lidH * 0.45);
    ctx.lineTo(cw / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 7 * u;
    ctx.strokeStyle = gold;
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(-cw * 0.28, -lidH * 0.95, cw * 0.07, lidH * 0.95);
    ctx.fillRect(cw * 0.21, -lidH * 0.95, cw * 0.07, lidH * 0.95);
    ctx.restore();
    if (before) {
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.arc(x + cw / 2, bodyY + 4 * u, cw * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rar.base[1];
      ctx.fillRect(x + cw / 2 - 3 * u, bodyY - 4 * u, 6 * u, 16 * u);
    }
    text(ctx, before ? "OPENING YOUR PACK\u2026" : "", cx, cy + ch * 0.75, F.mono(26 * u, 800), "rgba(255,255,255,0.75)");
    text(ctx, f.eventName.toUpperCase(), cx, cy - ch * 0.95, F.mono(24 * u, 800), rar.accent);
    ctx.restore();
  }
  const since = t - PACK_BURST;
  if (since >= 0) {
    const flash = 1 - clamp(since / 0.3);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (since < 1.2) {
      for (let i = 0; i < 28; i++) {
        const ang = i / 28 * Math.PI * 2 + i * 0.37;
        const sp = m * (0.5 + i * 0.618 % 1 * 0.6);
        const px = cx + Math.cos(ang) * sp * since;
        const py = cy + Math.sin(ang) * sp * since + 0.5 * m * 0.9 * since * since;
        sparkle(ctx, px, py, (10 + i % 4 * 5) * u, 1 - since / 1.2);
      }
    }
    const pop = clamp((since - 0.1) / 0.35);
    const out = 1 - clamp((t - 2.4) / 0.4);
    if (pop > 0 && out > 0) {
      const sc = pop < 1 ? 0.6 + 0.55 * Math.sin(pop * Math.PI * 0.75) : 1;
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(cx, H * 0.16);
      ctx.scale(sc, sc);
      ctx.shadowColor = rar.foil[0];
      ctx.shadowBlur = 30 * u;
      text(ctx, `${rar.name}!`, 0, 0, F.display(96 * u, 900), rar.accent);
      ctx.shadowBlur = 0;
      text(ctx, rar.stars, 0, 70 * u, F.sans(44 * u, 800), "#FFFFFF");
      ctx.restore();
    }
  }
}
function badgeLayout(W, H, u) {
  const wide2 = W >= H * 0.95;
  if (wide2) {
    const side = Math.min(220 * u, W * 0.1);
    const badge2 = { x: side, y: 150 * u, w: W - side * 2, h: H - 210 * u };
    const R2 = { x: badge2.x + 40 * u, y: badge2.y + 110 * u, w: badge2.w * 0.62, h: badge2.h - 150 * u };
    return { wide: wide2, badge: badge2, R: R2, info: { x: R2.x + R2.w + 36 * u, y: R2.y, w: badge2.x + badge2.w - 40 * u - (R2.x + R2.w + 36 * u), h: R2.h } };
  }
  const badge = { x: 100 * u, y: 250 * u, w: W - 200 * u, h: H - 330 * u };
  const R = { x: badge.x + 40 * u, y: badge.y + 140 * u, w: badge.w - 80 * u, h: badge.h - 520 * u };
  return { wide: wide2, badge, R, info: { x: R.x, y: R.y + R.h + 30 * u, w: R.w, h: badge.y + badge.h - 40 * u - (R.y + R.h + 30 * u) } };
}
var qrCache = /* @__PURE__ */ new Map();
function drawQr(ctx, data, x, y, size, ink, opts = {}) {
  const level = opts.round ? "H" : "M";
  let q = qrCache.get(level + data);
  if (!q) {
    q = QRCode.create(data, { errorCorrectionLevel: level });
    qrCache.set(level + data, q);
  }
  const n = q.modules.size;
  const cell = size / n;
  if (!opts.round) {
    ctx.fillStyle = ink;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
    return;
  }
  const eye = (r, c) => r < 7 && c < 7 || r < 7 && c >= n - 7 || r >= n - 7 && c < 7;
  const hole = Math.floor(n * 0.22);
  const mid0 = Math.floor((n - hole) / 2);
  const inHole = (r, c) => r >= mid0 && r < mid0 + hole && c >= mid0 && c < mid0 + hole;
  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!q.modules.get(r, c) || eye(r, c) || inHole(r, c)) continue;
      ctx.beginPath();
      ctx.arc(x + (c + 0.5) * cell, y + (r + 0.5) * cell, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const ex = x + c0 * cell;
    const ey = y + r0 * cell;
    ctx.fillStyle = opts.accent ?? ink;
    ctx.beginPath();
    ctx.roundRect(ex, ey, cell * 7, cell * 7, cell * 2);
    ctx.roundRect(ex + cell, ey + cell, cell * 5, cell * 5, cell * 1.4);
    ctx.fill("evenodd");
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(ex + cell * 2, ey + cell * 2, cell * 3, cell * 3, cell);
    ctx.fill();
  }
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rad = hole * cell / 2 - cell * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = opts.accent ?? ink;
  ctx.fill();
  ctx.clip();
  if (opts.avatar) {
    const a = opts.avatar;
    const s = Math.max(rad * 2 / a.width, rad * 2 / a.height);
    ctx.drawImage(a, cx - a.width * s / 2, cy - a.height * s / 2, a.width * s, a.height * s);
  } else if (opts.letter) text(ctx, opts.letter, cx, cy, F.sans(rad * 1.1, 900), "#FFFFFF");
  ctx.restore();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = cell * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
}
var fill = (ctx, f, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, f.W, f.H);
};
function coverImg(ctx, img, r) {
  const s = Math.max(r.w / img.width, r.h / img.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.drawImage(img, r.x + (r.w - img.width * s) / 2, r.y + (r.h - img.height * s) / 2, img.width * s, img.height * s);
  ctx.restore();
}
function deep(ctx, f, c, k = 0.45) {
  const g = ctx.createLinearGradient(0, 0, f.W, f.H);
  g.addColorStop(0, c);
  g.addColorStop(1, mix2(c, "#000000", k));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.W, f.H);
}
function dayOf(f) {
  const [y, mo, d] = (f.date ?? "").split("-").map(Number);
  if (y && mo && d) return new Date(y, mo - 1, d);
  if (f.brand) return /* @__PURE__ */ new Date();
  return new Date(2026, 10, 3 + Math.min(3, Math.floor(f.t / Math.max(1, f.total) * 4)));
}
var WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
var MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
var isWide = (W, H) => W > 1.3 * H;
function stamp(ctx, x, y, w, h, rot, color2, lines, u, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= 0.88;
  ctx.strokeStyle = color2;
  ctx.lineWidth = 5 * u;
  roundRect(ctx, { x: -w / 2, y: -h / 2, w, h }, 14 * u);
  ctx.stroke();
  ctx.lineWidth = 2 * u;
  roundRect(ctx, { x: -w / 2 + 9 * u, y: -h / 2 + 9 * u, w: w - 18 * u, h: h - 18 * u }, 9 * u);
  ctx.stroke();
  const lh = (h - 30 * u) / lines.length;
  lines.forEach((l, i) => {
    ctx.font = F.mono(lh * (i === 0 ? 0.62 : 0.5), 800);
    const px = Math.min(lh * (i === 0 ? 0.62 : 0.5), lh * (i === 0 ? 0.62 : 0.5) * (w - 36 * u) / Math.max(1, ctx.measureText(l).width));
    text(ctx, l, 0, -h / 2 + 15 * u + lh * (i + 0.5), F.mono(px, 800), color2);
  });
  ctx.restore();
}
function burst(ctx, x, y, r, spikes, fillC, stroke, lw) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = i / (spikes * 2) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.62 : r * (0.92 + 0.08 * Math.sin(i * 2.3));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillC;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}
function glow(ctx, s, x, y, font, color2, u, on = 1, align = "center") {
  ctx.save();
  ctx.globalAlpha *= 0.35 + 0.65 * on;
  ctx.shadowColor = color2;
  ctx.shadowBlur = 34 * u * on;
  text(ctx, s, x, y, font, color2, align);
  ctx.shadowBlur = 14 * u * on;
  text(ctx, s, x, y, font, mix2(color2, "#FFFFFF", 0.55), align);
  ctx.restore();
}
function codeLine(ctx, x, y, px, parts, maxW) {
  ctx.font = F.mono(px, 500);
  let cx = x;
  for (const [s, c] of parts) {
    const w = ctx.measureText(s).width;
    if (cx + w > x + maxW) {
      let cut = s;
      while (cut.length > 1 && cx + ctx.measureText(`${cut}\u2026`).width > x + maxW) cut = cut.slice(0, -1);
      text(ctx, `${cut}\u2026`, cx, y, F.mono(px, 500), c, "left");
      return;
    }
    text(ctx, s, cx, y, F.mono(px, 500), c, "left");
    cx += w;
  }
}
function boothLayout(W, H, u) {
  const pad = 24 * u;
  if (isWide(W, H)) {
    const cellW2 = (W - 200 * u - 5 * pad) / 4;
    const cellH2 = Math.min(H - 330 * u, cellW2 * 1.3);
    const strip3 = { x: 100 * u, y: (H - cellH2 - 2 * pad - 70 * u) / 2, w: W - 200 * u, h: cellH2 + 2 * pad + 70 * u };
    const cells2 = [0, 1, 2, 3].map((i) => ({ x: strip3.x + pad + i * (cellW2 + pad), y: strip3.y + pad, w: cellW2, h: cellH2 }));
    return { strip: strip3, cells: cells2, foot: { x: strip3.x, y: strip3.y + pad + cellH2, w: strip3.w, h: 70 * u + pad } };
  }
  const cellH = (H - 360 * u - 5 * pad) / 4;
  const cellW = Math.min(W - 220 * u, cellH * 1.35);
  const strip2 = { x: (W - cellW - 2 * pad) / 2, y: 120 * u, w: cellW + 2 * pad, h: 4 * cellH + 5 * pad + 90 * u };
  const cells = [0, 1, 2, 3].map((i) => ({ x: strip2.x + pad, y: strip2.y + pad + i * (cellH + pad), w: cellW, h: cellH }));
  return { strip: strip2, cells, foot: { x: strip2.x, y: strip2.y + 4 * (cellH + pad), w: strip2.w, h: 90 * u + pad } };
}
function dumpLayout(W, H, u) {
  if (isWide(W, H)) {
    const R2 = { x: 60 * u, y: 130 * u, w: W * 0.58, h: H - 220 * u };
    const g = { x: R2.x + R2.w + 30 * u, y: R2.y, w: W - 60 * u - (R2.x + R2.w + 30 * u), h: R2.h };
    return { R: R2, grid: g, cols: 2, rows: 3 };
  }
  const R = { x: 50 * u, y: 170 * u, w: W - 100 * u, h: H - 170 * u - 560 * u };
  return { R, grid: { x: R.x, y: R.y + R.h + 24 * u, w: R.w, h: 470 * u }, cols: 4, rows: 2 };
}
function playerLayout(W, H, u) {
  if (isWide(W, H)) {
    const h = H - 220 * u;
    const R2 = { x: 110 * u, y: 120 * u, w: Math.min(h * 1.1, W * 0.5), h };
    return { R: R2, info: { x: R2.x + R2.w + 70 * u, y: R2.y + R2.h * 0.18, w: W - 110 * u - (R2.x + R2.w + 70 * u) } };
  }
  const R = capped(200, 640, 70, 1)(W, H, u);
  return { R, info: { x: R.x, y: R.y + R.h + 60 * u, w: R.w } };
}
function calLayout(W, H, u) {
  const wide2 = isWide(W, H);
  const sheet = { x: 60 * u, y: 70 * u, w: W - 120 * u, h: H - 110 * u };
  const head = wide2 ? 230 * u : 360 * u;
  return { wide: wide2, sheet, R: { x: sheet.x + (wide2 ? 40 : 40) * u, y: sheet.y + head, w: sheet.w - 80 * u, h: sheet.h - head - (wide2 ? 90 : 140) * u } };
}
var CODE = { bar: 70, line: 44, top: 3, bottom: 4, status: 50, gutter: 100 };
function codeWindow(W, H, u) {
  const top = (CODE.bar + CODE.line * CODE.top + 26) * u;
  const bottom = (CODE.status + CODE.line * CODE.bottom + 26) * u;
  return { x: CODE.gutter * u, y: top, w: W - (CODE.gutter + 40) * u, h: H - top - bottom };
}
var COMIC_WORDS = ["POW!", "WOW!", "ZAP!", "BAM!", "BOOM!", "WHOA!", "YES!"];
var PASSPORT_STAMPS = ["ADMITTED", "SIDE QUEST", "ARRIVED", "CHECKED IN", "VISA", "LEVEL UP"];
var OPEN_STAMPS = ["ADMITTED", "VIP", "GOOD TIMES", "CHECKED IN", "ARRIVED", "LEVEL UP"];
function stampsOf(f) {
  if (!f.brand) return PASSPORT_STAMPS;
  const own = wordOf(f, "passport.stamps")?.split(",").map((x) => x.trim().toUpperCase().slice(0, 14)).filter(Boolean);
  return own?.length ? own : OPEN_STAMPS;
}
var DEFS = {
  clean: {
    label: "\u2728 Clean",
    group: "Clean",
    palettes: () => [
      P("Night", C.bg, C.white, C.grey, C.bg, C.white, C.neon, C.gold),
      P("Paper", "#F4F1EA", "#141413", "#6B6A66", "#FFFFFF", "#141413", "#2F5FBF", "#C8102E"),
      P("Marigold", "#1A1208", "#FFF6E5", "#B9A27A", "#2A1E10", "#FFF6E5", "#FFB020", "#FF6B3D"),
      P("Ocean", "#06202B", "#E6F6FF", "#7FA6B8", "#0B2E3C", "#E6F6FF", "#3DD6D0", "#FFD166"),
      P("Rose", "#2A0E1C", "#FFE9F2", "#C08AA3", "#3A1426", "#FFE9F2", "#FF7AB6", "#FFD166")
    ],
    window: banded(90, 90, 24),
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted);
    }
  },
  newspaper: {
    label: "\u{1F4F0} Newspaper",
    group: "Retro",
    palettes: () => [
      P("Classic", "#F2ECDD", "#1B1916", "#5A564E", "#F2ECDD", "#1B1916", "#1B1916", "#1B1916"),
      P("Pink paper", "#F4D8CB", "#1B1916", "#5A4A44", "#F4D8CB", "#1B1916", "#8A1C1C", "#1B1916"),
      P("Night edition", "#141414", "#EDE8DC", "#9A958A", "#141414", "#EDE8DC", "#F2C94C", "#EDE8DC"),
      P("Blueprint", "#E3ECF7", "#12305C", "#4A6080", "#E3ECF7", "#12305C", "#12305C", "#12305C"),
      P("Mint", "#E2F0E6", "#173A2A", "#4E6B5D", "#E2F0E6", "#173A2A", "#1F6B45", "#173A2A")
    ],
    // tall: room for a line of numbers between the headline and the photo
    window: (W, H, u) => capped(W > 1.3 * H ? 250 : 300, 130, 50, 1.5)(W, H, u),
    ownsText: true,
    back(ctx, f) {
      const ink = f.pal.ink;
      const { u, W, R } = f;
      const mx = 50 * u;
      fill(ctx, f, f.pal.paper);
      let y = 36 * u;
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), mx, y, F.mono(22 * u, 700), ink, "left"));
      dim(ctx, f, () => text(ctx, f.brand ? f.brand.site : "questpass.live", W - mx, y, F.mono(22 * u, 500), ink, "right"));
      y += 52 * u;
      {
        const mast = f.brand ? f.eventName : "The Mumbai Daily";
        ctx.font = F.display(76 * u, 900);
        const mpx = Math.min(76 * u, 76 * u * (W - mx * 2) / Math.max(1, ctx.measureText(mast).width));
        text(ctx, mast, W / 2, y, F.display(mpx, 900), f.pal.accent);
      }
      y += 48 * u;
      ctx.fillStyle = ink;
      ctx.fillRect(mx, y, W - mx * 2, 4 * u);
      y += 22 * u;
      text(ctx, [`${f.brand ? "SPECIAL" : f.eventName.toUpperCase()} EDITION`, f.eventDates.toUpperCase()].filter(Boolean).join("  \xB7  "), W / 2, y, F.mono(20 * u, 600), ink);
      y += 18 * u;
      ctx.fillRect(mx, y, W - mx * 2, 1.5 * u);
      ctx.font = F.display(46 * u, 900);
      const hl = wrap(ctx, wordOf(f, "newspaper.headline") ?? f.text, W - mx * 2, 1)[0] ?? "";
      text(ctx, hl, W / 2, R.x > mx * 3 ? (y + R.y) / 2 : (y + R.y - 50 * u) / 2, F.display(46 * u, 900), ink);
      const st = f.stats;
      const left = st ? [[st.pins.toLocaleString(), "passes pinned"], [String(st.countries), st.countries === 1 ? "country" : "countries"], [String(st.states), "Indian states"]] : [];
      const right = st ? [[`${f.journey.km.toLocaleString()} km`, `from ${f.journey.city}`], ...st.attended ? [[String(st.attended), st.attended === 1 ? "side event" : "side events"]] : []] : [];
      const story = wordOf(f, "newspaper.story");
      const column = (x0, w, head, rows, body) => {
        let yy = R.y + 10 * u;
        text(ctx, head, x0 + w / 2, yy, F.mono(16 * u, 700), ink);
        yy += 16 * u;
        ctx.fillRect(x0, yy, w, 2 * u);
        for (const [n, l] of rows) {
          yy += 52 * u;
          text(ctx, n, x0 + w / 2, yy, F.display(Math.min(44 * u, w / 5), 900), ink);
          yy += 34 * u;
          text(ctx, l.toUpperCase(), x0 + w / 2, yy, F.mono(14 * u, 600), ink);
          yy += 14 * u;
          ctx.fillStyle = withA(ink, 0.25);
          ctx.fillRect(x0 + w * 0.2, yy, w * 0.6, 1 * u);
          ctx.fillStyle = ink;
        }
        if (body) {
          ctx.font = F.sans(19 * u, 500);
          const ls = wrap(ctx, body, w, Math.max(1, Math.floor((R.y + R.h - yy - 40 * u) / (27 * u))));
          ls.forEach((l, i) => text(ctx, l, x0, yy + 34 * u + i * 27 * u, F.sans(19 * u, 500), ink, "left"));
          yy += ls.length * 27 * u + 10 * u;
        }
        ctx.fillStyle = withA(ink, 0.18);
        for (let ly = yy + 30 * u, i = 0; ly < R.y + R.h; ly += 26 * u, i++) ctx.fillRect(x0, ly, w * (0.7 + 0.3 * (i * 0.37 % 1)), 9 * u);
        ctx.fillStyle = ink;
      };
      if (R.x > mx * 3) {
        const w = R.x - mx * 2;
        ctx.fillStyle = ink;
        if (f.brand) {
          column(mx, w, "THE STORY", [], story);
          column(R.x + R.w + mx, w, f.journey.name ? `${firstName(f.journey.name).toUpperCase()}'S DAY` : "IN PICTURES", []);
        } else {
          column(mx, w, "BY THE NUMBERS", left);
          column(R.x + R.w + mx, w, `${firstName(f.journey.name).toUpperCase()}'S WEEK`, right);
        }
      } else if (st) {
        const line = `${st.pins.toLocaleString()} PINNED \xB7 ${st.countries} ${st.countries === 1 ? "COUNTRY" : "COUNTRIES"} \xB7 ${st.states} STATES${st.attended ? `  |  ${firstName(f.journey.name).toUpperCase()}: ${st.attended} EVENT${st.attended === 1 ? "" : "S"}` : ""}`;
        text(ctx, line, W / 2, R.y - 26 * u, F.mono(17 * u, 700), ink);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(R.x - 6 * u, R.y - 6 * u, R.w + 12 * u, R.h + 12 * u);
      const fy = R.y + R.h + (f.H - R.y - R.h) / 2;
      if (f.journey.handle ?? f.journey.name) text(ctx, `Photos: ${f.journey.handle ?? f.journey.name}`, mx, fy - 18 * u, F.mono(20 * u, 600), ink, "left");
      if (creditOf(f)) text(ctx, f.brand ? creditOf(f) : "Recap: @simarpreet_019", mx, fy + 16 * u, F.mono(20 * u, 500), ink, "left");
      const ad = wordOf(f, "newspaper.ad");
      const adLogo = f.brand?.adLogo;
      if (ad !== "" && (ad || adLogo || !f.brand || f.brand.sponsor)) {
        const bw = Math.min(W * 0.42, 460 * u);
        const bh = 84 * u;
        const bx = W - mx - bw;
        ctx.lineWidth = 2 * u;
        ctx.strokeRect(bx, fy - bh / 2, bw, bh);
        text(ctx, "ADVERTISEMENT", bx + bw / 2, fy - bh / 2 + 13 * u, F.mono(12 * u, 600), ink);
        if (ad) {
          ctx.font = F.sans(20 * u, 800);
          wrap(ctx, ad, bw - 24 * u, 2).forEach((l, i, all) => text(ctx, l, bx + bw / 2, fy + 10 * u + (i - (all.length - 1) / 2) * 24 * u, F.sans(20 * u, 800), ink));
        } else if (adLogo) {
          const lh = bh - 34 * u;
          const logo2 = { ...f.sponsor, id: `${f.sponsor.id}-ad`, logoImage: adLogo, logo: { ...f.sponsor.logo, mark: [], word: [] } };
          const lw = drawSponsorLogo(document.createElement("canvas").getContext("2d"), logo2, 0, 0, lh);
          dim(ctx, f, () => drawSponsorLogo(ctx, logo2, bx + bw / 2 - lw / 2, fy - bh / 2 + 25 * u, lh));
        } else poweredBy(ctx, f, bx + bw / 2, fy + 10 * u, 20 * u, ink, "center");
      }
    }
  },
  pass: {
    label: "\u{1F3AB} Boarding pass",
    group: "Travel",
    palettes: () => [
      P("Night flight", "#0B1424", C.gold, "#6B7280", "#F7F4EC", "#151923", C.neon, C.bg),
      P("Sunset", "#2A1030", "#FFB38A", "#8A6F78", "#FFF6EE", "#2A1A22", "#FF7A59", "#FFFFFF"),
      P("Emerald", "#06201A", "#9BE7C4", "#5E7268", "#F3F7F2", "#10261E", "#2BB673", "#FFFFFF"),
      P("First class", "#14110A", "#F2C94C", "#7A6F55", "#FBF5E6", "#1E1A10", "#F2C94C", "#14110A")
    ],
    window: (W, H, u) => passLayout(W, H, u).R,
    marks: ["tr"],
    back(ctx, f) {
      const { u, W, H } = f;
      const j = f.journey;
      const L = passLayout(W, H, u);
      const { card, stub, head } = L;
      const { paper, ink, muted } = f.pal;
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, f.pal.bg);
      bg.addColorStop(1, mix2(f.pal.bg, "#000000", 0.55));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.setLineDash([10 * u, 14 * u]);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(-40 * u, H * 0.9);
      ctx.quadraticCurveTo(W * 0.5, H * 0.2, W + 40 * u, H * 0.75);
      ctx.stroke();
      ctx.restore();
      const notch = L.wide ? { x: L.tear } : { y: L.tear };
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 40 * u;
      ctx.shadowOffsetY = 14 * u;
      ticketPath(ctx, card, 28 * u, notch, 26 * u);
      ctx.fillStyle = paper;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ticketPath(ctx, card, 28 * u, notch, 26 * u);
      ctx.clip();
      ctx.fillStyle = f.pal.accent;
      ctx.fillRect(card.x, card.y, card.w, 64 * u);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      if (L.wide) ctx.fillRect(stub.x, card.y, stub.w, card.h);
      else ctx.fillRect(card.x, stub.y, card.w, stub.h);
      ctx.restore();
      const px = 30 * u;
      text(ctx, `\u2708  ${[f.eventName.toUpperCase(), "BOARDING PASS"].filter(Boolean).join(" \xB7 ")}`, card.x + px, card.y + 33 * u, F.mono(22 * u, 800), f.pal.accent2, "left");
      text(ctx, f.eventDates.toUpperCase(), card.x + card.w - px, card.y + 33 * u, F.mono(20 * u, 700), f.pal.accent2, "right");
      const ry = head.y + 128 * u;
      const big = F.display(78 * u, 900);
      const rt = routeFor(f);
      text(ctx, rt.fromCode, head.x + px, ry, big, ink, "left");
      text(ctx, rt.toCode, head.x + head.w - px, ry, big, ink, "right");
      text(ctx, rt.from, head.x + px, ry + 50 * u, F.mono(17 * u, 700), muted, "left");
      text(ctx, rt.to, head.x + head.w - px, ry + 50 * u, F.mono(17 * u, 700), muted, "right");
      ctx.font = big;
      const a = head.x + px + ctx.measureText(rt.fromCode).width + 24 * u;
      const b = head.x + head.w - px - ctx.measureText(rt.toCode).width - 24 * u;
      if (b - a > 80 * u) {
        ctx.save();
        ctx.setLineDash([8 * u, 8 * u]);
        ctx.strokeStyle = withA(ink, 0.35);
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.moveTo(a, ry);
        ctx.lineTo(b, ry);
        ctx.stroke();
        ctx.restore();
        const k = clamp(f.t / Math.max(1, f.total));
        ctx.fillStyle = paper;
        ctx.fillRect(a + (b - a) * k - 26 * u, ry - 24 * u, 52 * u, 48 * u);
        text(ctx, "\u2708", a + (b - a) * k, ry, F.sans(40 * u, 700), f.pal.accent);
      }
      if (!L.wide) {
        text(ctx, f.brand ? "NON-STOP" : `${j.km.toLocaleString()} KM`, (a + b) / 2, ry + 50 * u, F.mono(17 * u, 700), muted);
      }
      ctx.strokeStyle = withA(ink, 0.18);
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(L.R.x - 4 * u, L.R.y - 4 * u, L.R.w + 8 * u, L.R.h + 8 * u);
      ctx.save();
      ctx.setLineDash([12 * u, 10 * u]);
      ctx.strokeStyle = withA(ink, 0.35);
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      if (L.wide) {
        ctx.moveTo(L.tear, card.y + 34 * u);
        ctx.lineTo(L.tear, card.y + card.h - 34 * u);
      } else {
        ctx.moveTo(card.x + 34 * u, L.tear);
        ctx.lineTo(card.x + card.w - 34 * u, L.tear);
      }
      ctx.stroke();
      ctx.restore();
      const fields = [
        ...f.brand ? [
          ["GUEST", (firstName(j.name) || "Guest").toUpperCase()],
          ["GATE", (wordOf(f, "pass.gate") ?? "A1").toUpperCase() || "\u2014"],
          ["SEAT", (wordOf(f, "pass.seat") ?? "VIP").toUpperCase() || "\u2014"],
          ["DATE", f.eventDates.toUpperCase() || "TODAY"]
        ] : [
          ["PASSENGER", firstName(j.name).toUpperCase()],
          ["FLIGHT", `QP ${String(j.traveller).padStart(3, "0")}`],
          ["SEAT", j.seat],
          ["DATE", j.landing.toUpperCase()]
        ]
      ];
      const label = F.mono(14 * u, 700);
      const value = F.mono(24 * u, 800);
      if (L.wide) {
        let y = stub.y + 110 * u;
        for (const [k, v] of fields) {
          text(ctx, k, stub.x + 40 * u, y, label, muted, "left");
          text(ctx, v, stub.x + 40 * u, y + 30 * u, value, ink, "left");
          y += 82 * u;
        }
        if (f.link) {
          const room = stub.y + stub.h - 210 * u - (y - 20 * u);
          const qs = Math.min(stub.w - 140 * u, room - 30 * u);
          if (qs > 90 * u) {
            const qx = stub.x + (stub.w - qs) / 2;
            drawQr(ctx, f.link, qx, y - 20 * u, qs, ink);
            text(ctx, f.brand ? "SCAN \xB7 MAKE YOURS" : "SCAN \xB7 CONNECT", stub.x + stub.w / 2, y - 20 * u + qs + 18 * u, F.mono(13 * u, 700), muted);
          }
        }
        barcode(ctx, ticketOf(f), stub.x + 40 * u, stub.y + stub.h - 190 * u, stub.w - 80 * u, 70 * u, ink);
        text(ctx, ticketOf(f), stub.x + stub.w / 2, stub.y + stub.h - 100 * u, F.mono(17 * u, 700), ink);
        poweredBy(ctx, f, stub.x + stub.w / 2, stub.y + stub.h - 60 * u, 18 * u, muted, "center");
      } else {
        const cw = (stub.w - 60 * u) / fields.length;
        fields.forEach(([k, v], i) => {
          const x = stub.x + 30 * u + cw * i;
          text(ctx, k, x, stub.y + 56 * u, label, muted, "left");
          ctx.font = value;
          const vv = ctx.measureText(v).width > cw - 10 * u ? v.slice(0, 7) : v;
          text(ctx, vv, x, stub.y + 88 * u, value, ink, "left");
        });
        const bw = stub.w * 0.44;
        barcode(ctx, ticketOf(f), stub.x + 30 * u, stub.y + 132 * u, bw, 90 * u, ink);
        text(ctx, ticketOf(f), stub.x + 30 * u + bw / 2, stub.y + 248 * u, F.mono(16 * u, 700), ink);
        const qs = Math.min(150 * u, stub.h - 140 * u);
        const qx = stub.x + stub.w - 30 * u - qs;
        if (f.link) {
          drawQr(ctx, f.link, qx, stub.y + 112 * u, qs, ink);
          text(ctx, f.brand ? "SCAN \xB7 MAKE YOURS" : "SCAN \xB7 CONNECT", qx + qs / 2, stub.y + 112 * u + qs + 16 * u, F.mono(12 * u, 700), muted);
        }
        const mx = (stub.x + 30 * u + bw + (f.link ? qx : stub.x + stub.w - 30 * u)) / 2;
        poweredBy(ctx, f, mx, stub.y + 165 * u, 18 * u, muted, "center");
        dim(ctx, f, () => text(ctx, creditOf(f), mx, stub.y + 210 * u, F.mono(14 * u, 500), muted));
      }
      const top = f.brand ? [f.brand.mark.toUpperCase(), f.brand.site].filter(Boolean).join(" \xB7 ") : "QUESTPASS \xB7 questpass.live";
      if (card.y > 40 * u && top) dim(ctx, f, () => text(ctx, top, W / 2, card.y / 2, F.mono(20 * u, 700), f.pal.fg));
    }
  },
  passport: {
    label: "\u{1F6C2} Passport page",
    group: "Travel",
    palettes: () => [
      P("Navy ink", "#EEF0E6", "#1F2A44", "#6A7085", "#EEF0E6", "#1F2A44", "#1F4E9C", "#2F6B5E"),
      P("Red ink", "#F4EEE6", "#2A1C1A", "#7A6660", "#F4EEE6", "#2A1C1A", "#B3202A", "#8A5A2B"),
      P("Green ink", "#EAF1E6", "#1A2A1E", "#5E7262", "#EAF1E6", "#1A2A1E", "#1F7A3A", "#2F5FBF"),
      P("Purple ink", "#F1ECF4", "#241A2E", "#6E6078", "#F1ECF4", "#241A2E", "#6B2FA0", "#C0566B")
    ],
    window: (W, H, u) => isWide(W, H) ? capped(200, 190, 60, 1.7)(W, H, u) : capped(330, 330, 90, 1.4)(W, H, u),
    marks: ["tr"],
    ownsDate: true,
    back(ctx, f) {
      const { u, W, H, R } = f;
      const j = f.journey;
      fill(ctx, f, f.pal.paper);
      ctx.strokeStyle = withA(f.pal.accent2, 0.13);
      ctx.lineWidth = 1.5 * u;
      for (let k = 0; k < 26; k++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12 * u) {
          const y = k / 26 * H + Math.sin(x / (70 * u) + k * 0.6) * 26 * u;
          if (x) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      const mx = Math.max(R.x, 50 * u);
      const top = R.y;
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - mx, top * 0.18, F.mono(20 * u, 700), f.pal.ink, "right"));
      const country = f.brand ? (wordOf(f, "passport.country") ?? `Republic of ${f.eventName || "Good Times"}`).toUpperCase() : "REPUBLIC OF SIDE QUESTS";
      ctx.font = F.mono(20 * u, 700);
      text(ctx, wrap(ctx, country, W * 0.6, 1)[0] ?? "", mx, top * 0.18, F.mono(20 * u, 700), f.pal.ink, "left");
      text(ctx, "VISAS", W / 2, top * 0.5, F.display(Math.min(84 * u, top * 0.32), 900), f.pal.accent2);
      text(ctx, [f.eventName.toUpperCase(), f.eventDates.toUpperCase()].filter(Boolean).join(" \xB7 "), W / 2, top * 0.78, F.mono(20 * u, 700), f.pal.muted);
      const last = j.name.split(/\s+/).slice(-1)[0] ?? j.name;
      const mrz1 = `P<QSP${last.toUpperCase()}<<${firstName(j.name).toUpperCase()}`.replace(/[^A-Z0-9<]/g, "<").padEnd(40, "<").slice(0, 40);
      const prt = routeFor(f);
      const mrz2 = `${ticketOf(f).replace(/[^A-Z0-9]/gi, "").toUpperCase()}<${prt.fromCode}${prt.toCode}<<${String(j.traveller).padStart(6, "0")}`.padEnd(40, "<").slice(0, 40);
      const bot = R.y + R.h;
      const room = f.H - bot;
      ctx.font = F.mono(26 * u, 600);
      const mpx = Math.min(26 * u, 26 * u * (W - mx * 2) / Math.max(1, ctx.measureText(mrz1).width));
      text(ctx, mrz1, W / 2, bot + room * 0.3, F.mono(mpx, 600), f.pal.ink);
      text(ctx, mrz2, W / 2, bot + room * 0.3 + mpx * 1.5, F.mono(mpx, 600), f.pal.ink);
      poweredBy(ctx, f, mx, H - room * 0.2, 20 * u, f.pal.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - mx, H - room * 0.2, F.mono(18 * u, 500), f.pal.muted, "right"));
    },
    front(ctx, f) {
      const { u, R } = f;
      ctx.strokeStyle = withA(f.pal.ink, 0.5);
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(R.x, R.y, R.w, R.h);
      const d = dayOf(f);
      const when = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      const spots = [
        [R.x + 20 * u, R.y + R.h * 0.12, -0.18],
        [R.x + R.w - 20 * u, R.y + R.h * 0.34, 0.14],
        [R.x + 30 * u, R.y + R.h * 0.6, 0.1],
        [R.x + R.w - 30 * u, R.y + R.h * 0.86, -0.12],
        [R.x + R.w * 0.3, R.y + R.h - 10 * u, 0.06],
        [R.x + R.w * 0.72, R.y + 10 * u, -0.08]
      ];
      const shown = f.seg ? Math.min(spots.length, f.seg.i + 1) : f.t > f.total / 2 ? spots.length : 0;
      const sw = Math.min(250 * u, R.w * 0.34);
      for (let k = 0; k < shown; k++) {
        const [x, y, rot] = spots[k];
        const fresh = f.seg && k === shown - 1 ? clamp(f.seg.p / 0.12) : 1;
        if (fresh <= 0) continue;
        ctx.save();
        ctx.globalAlpha = fresh;
        stamp(ctx, x, y, sw, sw * 0.56, rot, k % 2 ? f.pal.accent2 : f.pal.accent, [stampsOf(f)[k % stampsOf(f).length], f.brand ? f.eventDates ? `${routeFor(f).toCode} \xB7 ${when}` : routeFor(f).toCode : `BOM \xB7 ${when}`], u, 1 + (1 - fresh) * 0.6);
        ctx.restore();
      }
    }
  },
  ticket: {
    label: "\u{1F686} Local train ticket",
    group: "Travel",
    palettes: () => [
      P("Classic", "#1D2B22", "#F3E9C6", "#6F6650", "#F3E9C6", "#1C1A16", "#C8102E", "#1F4E9C"),
      P("First class pink", "#3A1A28", "#F8D9E3", "#7A5163", "#F8D9E3", "#2B1420", "#B0305C", "#2E8B87"),
      P("Metro blue", "#0E1A2B", "#DCE9F7", "#50647E", "#DCE9F7", "#10233D", "#0057B8", "#F2A33A"),
      P("Mint", "#10261E", "#DDF0E4", "#4E6B5D", "#DDF0E4", "#122B20", "#1F7A3A", "#D9480F")
    ],
    window: (W, H, u) => isWide(W, H) ? capped(190, 230, 80, 1.8)(W, H, u) : capped(330, 420, 90, 1.4)(W, H, u),
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H, R } = f;
      const j = f.journey;
      const { paper, ink, muted, accent } = f.pal;
      fill(ctx, f, f.pal.bg);
      const card = { x: 40 * u, y: 40 * u, w: W - 80 * u, h: H - 80 * u };
      ctx.fillStyle = paper;
      roundRect(ctx, card, 20 * u);
      ctx.fill();
      ctx.fillStyle = f.pal.bg;
      for (let y = card.y + 40 * u; y < card.y + card.h - 30 * u; y += 46 * u) {
        for (const x of [card.x, card.x + card.w]) {
          ctx.beginPath();
          ctx.arc(x, y, 9 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const mx = Math.max(R.x, 80 * u);
      const top = R.y - card.y;
      ctx.fillStyle = accent;
      ctx.fillRect(card.x + 30 * u, card.y + 26 * u, card.w - 60 * u, 50 * u);
      const lineName = f.brand ? (wordOf(f, "ticket.line") ?? `${f.eventName || "Good Times"} line`).toUpperCase() : "MUMBAI LOCAL \xB7 SIDE QUEST LINE";
      ctx.font = F.mono(22 * u, 800);
      text(ctx, wrap(ctx, lineName, W - 2 * mx, 1)[0] ?? "", W / 2, card.y + 51 * u, F.mono(22 * u, 800), onColor(accent));
      const trt = routeFor(f, "ticket.from");
      const ry = card.y + 76 * u + (top - 76 * u) * 0.42;
      const big = F.display(Math.min(80 * u, top * 0.3), 900);
      text(ctx, trt.fromCode, mx, ry, big, ink, "left");
      text(ctx, trt.toCode, W - mx, ry, big, ink, "right");
      text(ctx, "\u2192", W / 2, ry, F.sans(Math.min(64 * u, top * 0.24), 800), accent);
      text(ctx, f.brand ? ["FIRST CLASS \xB7 SINGLE JOURNEY", f.eventDates.toUpperCase()].filter(Boolean).join(" \xB7 ") : `FIRST CLASS \xB7 SINGLE JOURNEY \xB7 \u20B9 0.00 \xB7 ${f.eventDates.toUpperCase()}`, W / 2, card.y + 76 * u + (top - 76 * u) * 0.8, F.mono(17 * u, 700), muted);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(R.x - 5 * u, R.y - 5 * u, R.w + 10 * u, R.h + 10 * u);
      const bot = R.y + R.h;
      const room = card.y + card.h - bot;
      const ly = bot + room * 0.3;
      const own = wordOf(f, "ticket.stops")?.split(",").map((x) => x.trim().toUpperCase().slice(0, 12)).filter(Boolean);
      const stops = f.brand ? [trt.fromCode, ...(own?.length ? own : ["PHOTOS", "SNACKS", "DANCING"]).slice(0, 3), trt.toCode] : [j.code, "STAGE", "CHAI", "SIDE QUESTS", "BOM"];
      const x0 = mx + 20 * u;
      const x1 = W - mx - 20 * u;
      ctx.strokeStyle = withA(ink, 0.4);
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      ctx.moveTo(x0, ly);
      ctx.lineTo(x1, ly);
      ctx.stroke();
      stops.forEach((s, i) => {
        const x = x0 + (x1 - x0) * i / (stops.length - 1);
        ctx.fillStyle = paper;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.arc(x, ly, 12 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        text(ctx, s, x, ly + 36 * u, F.mono(15 * u, 700), muted, i === 0 ? "left" : i === stops.length - 1 ? "right" : "center");
      });
      const k = clamp(f.t / Math.max(1, f.total));
      ctx.fillStyle = accent;
      roundRect(ctx, { x: x0 + (x1 - x0) * k - 26 * u, y: ly - 14 * u, w: 52 * u, h: 28 * u }, 10 * u);
      ctx.fill();
      text(ctx, `TICKET ${ticketOf(f)}`, mx, card.y + card.h - room * 0.28, F.mono(18 * u, 700), ink, "left");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - mx, card.y + card.h - room * 0.28, F.mono(18 * u, 700), ink, "right"));
      poweredBy(ctx, f, mx, card.y + card.h - room * 0.12, 18 * u, muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - mx, card.y + card.h - room * 0.12, F.mono(16 * u, 500), muted, "right"));
    }
  },
  polaroid: {
    label: "\u{1F4F8} Polaroid",
    group: "Clean",
    palettes: () => [
      P("Night", C.bg, C.neon, C.grey, "#FAF8F3", "#2A2622", C.gold, C.gold),
      P("Cork board", "#A47B52", "#FFF8EC", "#F1DFC5", "#FAF8F3", "#2A2622", "#3A2414", "#3A2414"),
      P("Blush", "#F4C9D6", "#5A1E33", "#8A5466", "#FFFDF9", "#3A2630", "#B0305C", "#B0305C"),
      P("Mint", "#BFE6D5", "#123D2E", "#3F6B5B", "#FFFFFF", "#23302A", "#0E7A55", "#0E7A55"),
      P("Black", "#0A0A0A", "#FFFFFF", "#9A9A9A", "#F5F5F2", "#111111", "#FF4F4F", "#FF4F4F")
    ],
    window: capped(130, 250, 110, 1.4),
    tilt: -0.025,
    back(ctx, f) {
      const { u, R } = f;
      fill(ctx, f, f.pal.bg);
      const card = { x: R.x - 30 * u, y: R.y - 30 * u, w: R.w + 60 * u, h: R.h + 170 * u };
      ctx.save();
      ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
      ctx.rotate(-0.025);
      ctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRect(ctx, { ...card, x: card.x + 10 * u, y: card.y + 14 * u }, 6 * u);
      ctx.fill();
      ctx.fillStyle = f.pal.paper;
      roundRect(ctx, card, 6 * u);
      ctx.fill();
      text(ctx, f.brand ? [firstName(f.journey.name), f.eventName].filter(Boolean).join(" \xB7 ") : `${firstName(f.journey.name)} \xB7 Mumbai '26`, R.x + R.w / 2, R.y + R.h + 82 * u, `italic 600 ${42 * u}px Georgia, serif`, f.pal.ink);
      ctx.restore();
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted, card.y, card.y + card.h);
    }
  },
  film: {
    label: "\u{1F39E}\uFE0F Film strip",
    group: "Retro",
    palettes: () => [
      P("Black", "#111111", "#EEEEEE", "#A6A6A6", "#EEEEEE", "#111111", C.gold, C.gold),
      P("Sepia", "#2B1D12", "#F2E3C6", "#BFA88A", "#F2E3C6", "#2B1D12", "#E0A458", "#E0A458"),
      P("Navy", "#0D1B2A", "#E0E6EE", "#94A3B8", "#E0E6EE", "#0D1B2A", "#7FB7FF", "#7FB7FF"),
      P("Red", "#3A0D0D", "#F5E6E6", "#C9A0A0", "#F5E6E6", "#3A0D0D", "#FFC440", "#FFC440")
    ],
    window: banded(100, 100, 90),
    back(ctx, f) {
      const { u, R } = f;
      fill(ctx, f, f.pal.bg);
      ctx.fillStyle = f.pal.paper;
      const hw = 22 * u;
      const hh = 30 * u;
      for (let y = R.y; y < R.y + R.h - hh; y += hh * 1.9) {
        roundRect(ctx, { x: R.x - hw * 1.8, y, w: hw, h: hh }, 4 * u);
        ctx.fill();
        roundRect(ctx, { x: R.x + R.w + hw * 0.8, y, w: hw, h: hh }, 4 * u);
        ctx.fill();
      }
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted);
    }
  },
  cinema: {
    label: "\u{1F3AC} After-movie",
    group: "Retro",
    palettes: () => [
      P("Black", "#000000", "#FFFFFF", "#9A9A9A", "#000000", "#FFFFFF", C.gold, C.gold),
      P("Midnight", "#06101F", "#E8F0FF", "#8597B5", "#06101F", "#E8F0FF", "#7FB7FF", "#7FB7FF"),
      P("Wine", "#1C0710", "#FFE8EF", "#B8899A", "#1C0710", "#FFE8EF", "#FF7AB6", "#FF7AB6"),
      P("White", "#F5F3EE", "#111111", "#6B6A66", "#F5F3EE", "#111111", "#C8102E", "#C8102E")
    ],
    window: banded(150, 150, 0),
    marks: ["tl", "tr", "bl"],
    back(ctx, f) {
      const { u, R, W } = f;
      fill(ctx, f, f.pal.bg);
      const who = f.journey.name.toUpperCase();
      text(ctx, f.brand ? who ? `STARRING ${who}` : "NOW SHOWING" : who ? `${who}  \xB7  IN` : "NOW SHOWING", W / 2, R.y / 2 - 16 * u, F.mono(20 * u, 600), f.pal.muted, "center");
      const story = f.brand ? f.eventName.toUpperCase() || "OUR STORY" : `A ${f.eventName.toUpperCase()} STORY`;
      ctx.font = F.display(40 * u, 900);
      const spx = Math.min(40 * u, 40 * u * (W - 80 * u) / Math.max(1, ctx.measureText(story).width));
      text(ctx, story, W / 2, R.y / 2 + 20 * u, F.display(spx, 900), f.pal.fg);
      const by = R.y + R.h + (f.H - R.y - R.h) / 2;
      poweredBy(ctx, f, W / 2, by - 18 * u, 20 * u, f.pal.muted, "center");
      dim(ctx, f, () => text(ctx, signOf(f), W / 2, by + 24 * u, F.mono(18 * u, 500), f.pal.muted));
    },
    front(ctx, f) {
      const s = Math.floor(f.t);
      const tc = `00:00:${String(s).padStart(2, "0")}:${String(Math.floor(f.t % 1 * 24)).padStart(2, "0")}`;
      text(ctx, tc, f.R.x + f.R.w - 30 * f.u, f.R.y + f.R.h - 34 * f.u, F.mono(22 * f.u, 600), "rgba(255,255,255,0.8)", "right");
    }
  },
  vhs: {
    label: "\u{1F4FC} VHS",
    group: "Retro",
    palettes: () => [
      P("Red", "#000000", "#EEEEEE", "#A6A6A6", "#000000", "#EEEEEE", "#FF4F4F", "#FF3030"),
      P("Green screen", "#000000", "#D8FFD0", "#7FAF7A", "#000000", "#D8FFD0", "#39FF14", "#39FF14"),
      P("Blue screen", "#0033AA", "#FFFFFF", "#C9D6F5", "#0033AA", "#FFFFFF", "#FFE14D", "#FF3030"),
      P("Purple", "#160A2A", "#F1E6FF", "#A794C4", "#160A2A", "#F1E6FF", "#C77DFF", "#FF3030")
    ],
    window: banded(70, 70, 0),
    marks: ["br"],
    ownsDate: true,
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted);
    },
    front(ctx, f) {
      const { u, R, t } = f;
      const px = 30 * u;
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = f.pal.accent2;
        ctx.beginPath();
        ctx.arc(R.x + 46 * u, R.y + 50 * u, 12 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      text(ctx, "REC", R.x + 68 * u, R.y + 50 * u, F.mono(px, 700), "#FFFFFF", "left");
      text(ctx, "PLAY \u25B6", R.x + R.w - 40 * u, R.y + 50 * u, F.mono(px, 700), "#FFFFFF", "right");
      const [y, mo, d] = (f.date ?? "").split("-");
      const day = y && mo && d ? `${MONTHS[Number(mo) - 1] ?? "NOV"} ${Number(d)} ${y}` : `NOV ${3 + Math.min(3, Math.floor(t / f.total * 4))} 2026`;
      dim(ctx, f, () => text(ctx, `${day}  MUMBAI`, R.x + 40 * u, R.y + R.h - 46 * u, F.mono(px, 700), "#FFFFFF", "left"));
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let yy = R.y; yy < R.y + R.h; yy += 4 * u) ctx.fillRect(R.x, yy, R.w, 1.5 * u);
    }
  },
  postcard: {
    label: "\u{1F48C} Postcard",
    group: "Retro",
    palettes: () => [
      P("Airmail", "#E9DFC9", "#3A3226", "#5A5040", "#FFFDF7", "#3A3226", "#C8102E", "#1F4E9C"),
      P("Sky", "#CFE3F2", "#1E3346", "#4A6378", "#FFFFFF", "#1E3346", "#1F6FB2", "#F2A33A"),
      P("Blush", "#F3D4D8", "#43262C", "#7A5560", "#FFFBFA", "#43262C", "#D94F70", "#2E8B87"),
      P("Night", "#1B2233", "#F2EDE3", "#A9B0C0", "#FFFDF7", "#2B2B33", "#FF6B6B", "#6FA8FF")
    ],
    window: capped(200, 230, 70, 1.6),
    marks: ["bl", "br", "tl"],
    back(ctx, f) {
      const { u, R, W } = f;
      const p = f.pal;
      fill(ctx, f, p.bg);
      const card = { x: R.x - 26 * u, y: R.y - 26 * u, w: R.w + 52 * u, h: R.h + 52 * u };
      ctx.fillStyle = p.paper;
      roundRect(ctx, card, 8 * u);
      ctx.fill();
      ctx.save();
      roundRect(ctx, card, 8 * u);
      ctx.clip();
      for (let i = -card.h; i < card.w + card.h; i += 36 * u) {
        ctx.fillStyle = i / (36 * u) % 2 ? p.accent : p.accent2;
        ctx.beginPath();
        ctx.moveTo(card.x + i, card.y);
        ctx.lineTo(card.x + i + 18 * u, card.y);
        ctx.lineTo(card.x + i + 18 * u - card.h, card.y + card.h);
        ctx.lineTo(card.x + i - card.h, card.y + card.h);
        ctx.fill();
      }
      ctx.fillStyle = p.paper;
      ctx.fillRect(card.x + 12 * u, card.y + 12 * u, card.w - 24 * u, card.h - 24 * u);
      ctx.restore();
      const ty = card.y / 2;
      text(ctx, "Greetings from", W / 2, ty - 28 * u, `italic 600 ${32 * u}px Georgia, serif`, p.fg);
      {
        const where = (f.brand ? f.eventName : "Mumbai").toUpperCase();
        ctx.font = F.display(52 * u, 900);
        const wpx = Math.min(52 * u, 52 * u * (W - 80 * u) / Math.max(1, ctx.measureText(where).width));
        text(ctx, where, W / 2, ty + 20 * u, F.display(wpx, 900), p.accent);
      }
      const bt = card.y + card.h;
      const by = bt + (f.H - bt) / 2;
      ctx.font = `italic 600 ${30 * u}px Georgia, serif`;
      const sign = f.journey.name ? ` \u2014 ${firstName(f.journey.name)}` : "";
      const own = (wordOf(f, "postcard.message") ?? f.note)?.trim();
      const note = own ? [`${own}${sign}`, own].find((s) => ctx.measureText(s).width < card.w) ?? wrap(ctx, own, card.w, 1)[0] ?? own : f.brand ? [`Wish you were here!${sign}`].find((s) => ctx.measureText(s).width < card.w) ?? "Wish you were here!" : [`Side quests unlocked at ${f.eventName}!${sign}`, `Side quests unlocked!${sign}`].find((s) => ctx.measureText(s).width < card.w) ?? "Side quests unlocked!";
      text(ctx, note, W / 2, by - 34 * u, `italic 600 ${30 * u}px Georgia, serif`, p.fg);
      if (W > 1.3 * f.H) {
        poweredBy(ctx, f, card.x, by + 30 * u, 20 * u, p.muted, "left");
        dim(ctx, f, () => text(ctx, signOf(f), card.x + card.w, by + 30 * u, F.mono(18 * u, 500), p.muted, "right"));
      } else {
        poweredBy(ctx, f, W / 2, by + 18 * u, 20 * u, p.muted, "center");
        dim(ctx, f, () => text(ctx, signOf(f), W / 2, by + 54 * u, F.mono(18 * u, 500), p.muted));
      }
    },
    front(ctx, f) {
      const { u, R } = f;
      const s = { x: R.x + R.w - 130 * u, y: R.y + 20 * u, w: 110 * u, h: 130 * u };
      ctx.fillStyle = f.pal.paper;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = f.pal.accent;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(s.x + 8 * u, s.y + 8 * u, s.w - 16 * u, s.h - 16 * u);
      text(ctx, f.brand ? "\u2605" : "BOM", s.x + s.w / 2, s.y + 52 * u, F.mono(30 * u, 800), f.pal.accent);
      text(ctx, f.brand ? "POST" : "\u20B9 5", s.x + s.w / 2, s.y + 92 * u, F.mono(22 * u, 700), f.pal.accent2);
    }
  },
  scrapbook: {
    label: "\u{1F4D2} Scrapbook",
    group: "Retro",
    palettes: () => [
      P("Kraft", "#F4E7D3", "#3A2E22", "#6A5A48", "#F4E7D3", "#5A78AA", "#B4552B", "#F0BE5A"),
      P("Mint", "#E3F2EA", "#1F3A2E", "#4E6B5D", "#E3F2EA", "#4E8A75", "#2E8B57", "#F7A6B8"),
      P("Lavender", "#ECE6F7", "#2E2440", "#6A5E80", "#ECE6F7", "#7A6AB0", "#7B4FC9", "#9FD8CB"),
      P("Lemon", "#FFF6D6", "#3A3010", "#7A6A35", "#FFF6D6", "#C9A227", "#D9480F", "#74C0FC")
    ],
    window: capped(150, 200, 90, 1.5),
    tilt: 0.02,
    marks: ["tr", "bl"],
    back(ctx, f) {
      const { u, R, W } = f;
      fill(ctx, f, f.pal.bg);
      ctx.strokeStyle = withA(f.pal.ink, 0.18);
      ctx.lineWidth = 2 * u;
      for (let y = 40 * u; y < f.H; y += 48 * u) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      const title = f.brand ? [firstName(f.journey.name) && `${firstName(f.journey.name)}'s`, f.eventName || "diary"].filter(Boolean).join(" ") : `${firstName(f.journey.name)}'s Mumbai diary`;
      ctx.font = `italic 700 ${44 * u}px Georgia, serif`;
      const tpx = Math.min(44 * u, 44 * u * (W - 120 * u) / Math.max(1, ctx.measureText(title).width));
      text(ctx, title, W / 2, R.y * 0.7, `italic 700 ${tpx}px Georgia, serif`, f.pal.fg);
      bands(ctx, f, f.pal.fg, f.pal.accent, f.pal.muted, R.y * 0.5, R.y + R.h);
    },
    front(ctx, f) {
      const { u, R } = f;
      const tape = (x, y, a) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = withA(f.pal.accent2, 0.8);
        ctx.fillRect(-90 * u, -22 * u, 180 * u, 44 * u);
        ctx.restore();
      };
      tape(R.x + 10 * u, R.y + 10 * u, -0.7);
      tape(R.x + R.w - 10 * u, R.y + R.h - 10 * u, -0.7);
    }
  },
  magazine: {
    label: "\u{1F4D6} Magazine cover",
    group: "Clean",
    palettes: () => [
      P("Classic", "#000000", "#FFFFFF", "#CCCCCC", "#000000", "#FFFFFF", C.gold, C.gold),
      P("Red masthead", "#000000", "#E3262E", "#CCCCCC", "#000000", "#FFFFFF", "#FFFFFF", "#FFFFFF"),
      P("Yellow", "#000000", "#FFD400", "#CCCCCC", "#000000", "#FFFFFF", "#FFFFFF", "#FFFFFF"),
      P("Pink", "#000000", "#FF6FB5", "#CCCCCC", "#000000", "#FFFFFF", "#FFE14D", "#FFE14D")
    ],
    window: banded(0, 0, 0),
    // its own masthead and footer carry the branding
    marks: [],
    ownsText: true,
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
    },
    front(ctx, f) {
      const { u, W, H } = f;
      const top = ctx.createLinearGradient(0, 0, 0, 320 * u);
      top.addColorStop(0, "rgba(0,0,0,0.65)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 320 * u);
      const bot = ctx.createLinearGradient(0, H - 360 * u, 0, H);
      bot.addColorStop(0, "rgba(0,0,0,0)");
      bot.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = bot;
      ctx.fillRect(0, H - 360 * u, W, 360 * u);
      const mast = f.eventName.toUpperCase();
      ctx.font = F.display(120 * u, 900);
      const mpx = Math.min(120 * u, 120 * u * (W - 100 * u) / Math.max(1, ctx.measureText(mast).width));
      text(ctx, mast, W / 2, 50 * u + mpx * 0.5, F.display(mpx, 900), f.pal.fg);
      text(ctx, f.brand ? ["SPECIAL ISSUE", markOf(f).toUpperCase(), f.eventDates.toUpperCase()].filter(Boolean).join(" \xB7 ") : `SIDE QUEST ISSUE \xB7 QUESTPASS \xB7 ${f.eventDates.toUpperCase()}`, W / 2, 80 * u + mpx, F.mono(22 * u, 700), f.pal.accent);
      const k = Math.min(clamp((f.t - 2.8) / 0.4), 1 - (f.t > 3 ? f.promo ?? 0 : 0));
      if (k > 0) {
        ctx.save();
        ctx.globalAlpha = k;
        ctx.font = F.sans(44 * u, 800);
        const lines = wrap(ctx, wordOf(f, "magazine.cover") ?? f.text, W - 120 * u, 2);
        lines.forEach((l, i) => text(ctx, l, 60 * u, H - 210 * u + i * 54 * u, F.sans(44 * u, 800), f.pal.ink, "left"));
        ctx.restore();
      }
      poweredBy(ctx, f, 60 * u, H - 70 * u, 20 * u, "rgba(255,255,255,0.8)", "left");
      dim(ctx, f, () => text(ctx, signOf(f), W - 60 * u, H - 70 * u, F.mono(18 * u, 500), "rgba(255,255,255,0.7)", "right"));
    }
  },
  calendar: {
    label: "\u{1F4C5} Calendar page",
    group: "Clean",
    palettes: () => [
      P("Red", "#2A2F38", "#FFFFFF", "#8A8A8A", "#FFFFFF", "#1A1A1A", "#E03A3A", "#E03A3A"),
      P("Blue", "#1E2633", "#FFFFFF", "#8A8A8A", "#FFFFFF", "#1A1A1A", "#2F6FDB", "#2F6FDB"),
      P("Green", "#1F2A24", "#FFFFFF", "#8A8A8A", "#FFFFFF", "#1A1A1A", "#1F9D55", "#1F9D55"),
      P("Marigold", "#2E2416", "#FFFFFF", "#8A8A8A", "#FFFBF2", "#1A1A1A", "#F59E0B", "#F59E0B"),
      P("Black", "#D9D6CF", "#111111", "#8A8A8A", "#FFFFFF", "#111111", "#111111", "#111111")
    ],
    window: (W, H, u) => calLayout(W, H, u).R,
    marks: ["tr", "br"],
    ownsDate: true,
    back(ctx, f) {
      const { u, W, H } = f;
      const L = calLayout(W, H, u);
      const { sheet, R } = L;
      const p = f.pal;
      fill(ctx, f, p.bg);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 30 * u;
      ctx.shadowOffsetY = 10 * u;
      ctx.fillStyle = p.paper;
      roundRect(ctx, sheet, 18 * u);
      ctx.fill();
      ctx.restore();
      const band = (L.wide ? 80 : 110) * u;
      ctx.save();
      roundRect(ctx, sheet, 18 * u);
      ctx.clip();
      ctx.fillStyle = p.accent;
      ctx.fillRect(sheet.x, sheet.y, sheet.w, band);
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const x = sheet.x + sheet.w * (0.1 + i * 0.16);
        ctx.fillStyle = mix2(p.bg, "#000000", 0.3);
        ctx.beginPath();
        ctx.arc(x, sheet.y + 22 * u, 11 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#C9CCD2";
        ctx.lineWidth = 6 * u;
        ctx.beginPath();
        ctx.moveTo(x, sheet.y - 20 * u);
        ctx.lineTo(x, sheet.y + 22 * u);
        ctx.stroke();
      }
      const d = dayOf(f);
      const on = onColor(p.accent);
      text(ctx, `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, sheet.x + 40 * u, sheet.y + band * 0.62, F.mono(30 * u, 800), on, "left");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), sheet.x + sheet.w - 40 * u, sheet.y + band * 0.62, F.mono(22 * u, 700), on, "right"));
      const dy = sheet.y + band + (R.y - sheet.y - band) / 2;
      const big = F.display(Math.min(180 * u, (R.y - sheet.y - band) * 0.8), 900);
      text(ctx, String(d.getDate()), sheet.x + 40 * u, dy + 6 * u, big, p.accent, "left");
      ctx.font = big;
      const nx = sheet.x + 40 * u + ctx.measureText(String(d.getDate())).width + 30 * u;
      text(ctx, WEEKDAYS[d.getDay()], nx, dy - 24 * u, F.mono(30 * u, 800), p.ink, "left");
      text(ctx, titleAt(f), nx, dy + 22 * u, F.sans(28 * u, 700), p.muted, "left");
      text(ctx, firstName(f.journey.name), sheet.x + sheet.w - 40 * u, dy + 22 * u, `italic 700 ${34 * u}px Georgia, serif`, p.accent, "right");
      const fy = R.y + R.h + (sheet.y + sheet.h - R.y - R.h) / 2;
      poweredBy(ctx, f, sheet.x + 40 * u, fy, 20 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), sheet.x + sheet.w - 40 * u, fy, F.mono(18 * u, 500), p.muted, "right"));
    }
  },
  player: {
    label: "\u{1F3A7} Now playing",
    group: "Clean",
    palettes: () => [
      P("Green", "#1E3A2B", "#FFFFFF", "#A7B3AC", "#0B0F0D", "#FFFFFF", "#1ED760", "#1ED760"),
      P("Purple", "#3B1E5A", "#FFFFFF", "#B9A8CC", "#0E0A14", "#FFFFFF", "#C77DFF", "#C77DFF"),
      P("Orange", "#6A2B12", "#FFFFFF", "#D2B3A6", "#140A06", "#FFFFFF", "#FF8A3D", "#FF8A3D"),
      P("Light", "#F2F2F2", "#111111", "#666666", "#D6D6D6", "#111111", "#E03A3A", "#E03A3A")
    ],
    window: (W, H, u) => playerLayout(W, H, u).R,
    marks: ["tl", "tr"],
    ownsText: true,
    back(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const { R, info } = playerLayout(W, H, u);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, p.bg);
      g.addColorStop(1, p.paper);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const ty = isWide(W, H) ? 60 * u : R.y * 0.4;
      text(ctx, "\u2304", 60 * u, ty, F.sans(44 * u, 700), p.fg, "left");
      text(ctx, "\u22EF", W - 60 * u, ty, F.sans(44 * u, 700), p.fg, "right");
      dim(ctx, f, () => text(ctx, markOf(f) ? `PLAYING FROM ${markOf(f).toUpperCase()}` : "NOW PLAYING", W / 2, ty - 18 * u, F.mono(17 * u, 700), p.muted));
      text(ctx, titleAt(f), W / 2, ty + 18 * u, F.sans(24 * u, 800), p.fg);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 40 * u;
      ctx.fillStyle = "#000";
      ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.restore();
      const y0 = info.y + 30 * u;
      ctx.font = F.sans(46 * u, 800);
      const title = wrap(ctx, f.text, info.w - 80 * u, 1)[0] ?? "";
      text(ctx, title, info.x, y0, F.sans(46 * u, 800), p.fg, "left");
      text(ctx, f.journey.name, info.x, y0 + 50 * u, F.sans(28 * u, 600), p.muted, "left");
      text(ctx, "\u2665", info.x + info.w, y0 + 20 * u, F.sans(48 * u, 700), p.accent, "right");
      const by = y0 + 130 * u;
      const k = clamp(f.t / Math.max(1, f.total));
      ctx.fillStyle = withA(p.fg, 0.25);
      roundRect(ctx, { x: info.x, y: by - 4 * u, w: info.w, h: 8 * u }, 4 * u);
      ctx.fill();
      ctx.fillStyle = p.fg;
      roundRect(ctx, { x: info.x, y: by - 4 * u, w: info.w * k, h: 8 * u }, 4 * u);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(info.x + info.w * k, by, 13 * u, 0, Math.PI * 2);
      ctx.fill();
      const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      text(ctx, mmss(f.t), info.x, by + 38 * u, F.mono(20 * u, 600), p.muted, "left");
      text(ctx, `-${mmss(Math.max(0, f.total - f.t))}`, info.x + info.w, by + 38 * u, F.mono(20 * u, 600), p.muted, "right");
      const cy = by + 140 * u;
      const cx = info.x + info.w / 2;
      const gap = Math.min(170 * u, info.w / 4.6);
      text(ctx, "\u21C4", cx - gap * 2, cy, F.sans(40 * u, 700), p.accent, "center");
      text(ctx, "\u23EE", cx - gap, cy, F.sans(52 * u, 700), p.fg, "center");
      ctx.fillStyle = p.fg;
      ctx.beginPath();
      ctx.arc(cx, cy, 62 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix2(p.paper, "#000000", 0.2);
      ctx.fillRect(cx - 20 * u, cy - 24 * u, 13 * u, 48 * u);
      ctx.fillRect(cx + 7 * u, cy - 24 * u, 13 * u, 48 * u);
      text(ctx, "\u23ED", cx + gap, cy, F.sans(52 * u, 700), p.fg, "center");
      text(ctx, "\u21BB", cx + gap * 2, cy, F.sans(44 * u, 700), p.muted, "center");
      const fy = Math.min(H - 50 * u, cy + 130 * u);
      poweredBy(ctx, f, info.x, fy, 20 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), info.x + info.w, fy, F.mono(17 * u, 500), p.muted, "right"));
    }
  },
  tablet: {
    label: "\u{1F4F1} Tablet",
    group: "For devs",
    palettes: () => [
      P("Space grey", "#1E2A3A", "#E8EDF5", "#9AA6B6", "#16171B", "#5C6370", C.neon, C.neon),
      P("Silver", "#DCE3EC", "#1B2330", "#5A6577", "#E9ECF0", "#A9B0BA", "#2F5FBF", "#2F5FBF"),
      P("Rose gold", "#F3D9D2", "#4A2A28", "#8A625D", "#F6E3DD", "#C99A8E", "#C0566B", "#C0566B"),
      P("Midnight green", "#0E2A24", "#E4F2EC", "#8FB0A5", "#13201C", "#4F6B62", "#4CD3A5", "#4CD3A5")
    ],
    window: capped(170, 170, 90, 1.45),
    marks: ["bl", "br"],
    back(ctx, f) {
      const { u, R, W } = f;
      const p = f.pal;
      deep(ctx, f, p.bg, 0.6);
      const b = 30 * u;
      const body = { x: R.x - b, y: R.y - b, w: R.w + b * 2, h: R.h + b * 2 };
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, { ...body, x: body.x + 8 * u, y: body.y + 14 * u }, 56 * u);
      ctx.fill();
      ctx.fillStyle = p.paper;
      roundRect(ctx, body, 56 * u);
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 3 * u;
      ctx.stroke();
      ctx.fillStyle = mix2(p.paper, "#5C6370", 0.5);
      ctx.beginPath();
      ctx.arc(W / 2, body.y + b / 2, 6 * u, 0, Math.PI * 2);
      ctx.fill();
      bands(ctx, f, p.fg, p.accent, p.muted, body.y, body.y + body.h);
    },
    front(ctx, f) {
      const { u, R, t } = f;
      const y = R.y + 22 * u;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(R.x, R.y, R.w, 44 * u);
      text(ctx, `9:${String(41 + Math.floor(t / 10)).padStart(2, "0")}`, R.x + 24 * u, y, F.sans(20 * u, 700), "#FFFFFF", "left");
      text(ctx, placeOf(f), R.x + R.w / 2, y, F.sans(18 * u, 600), "rgba(255,255,255,0.85)");
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2 * u;
      const bx = R.x + R.w - 64 * u;
      ctx.strokeRect(bx, y - 9 * u, 38 * u, 18 * u);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(bx + 3 * u, y - 6 * u, 26 * u, 12 * u);
      ctx.fillRect(bx + 39 * u, y - 4 * u, 3 * u, 8 * u);
    }
  },
  code: {
    label: "\u{1F4BB} Code editor",
    group: "For devs",
    // ink: plain code, fg: strings, accent2: keywords, muted: comments, accent: the status bar
    palettes: () => [
      P("Dark", "#1E1E1E", "#CE9178", "#6A9955", "#252526", "#D4D4D4", "#007ACC", "#569CD6"),
      P("Night purple", "#282A36", "#F1FA8C", "#6272A4", "#21222C", "#F8F8F2", "#BD93F9", "#FF79C6"),
      P("Light", "#FDF6E3", "#2AA198", "#93A1A1", "#EEE8D5", "#586E75", "#268BD2", "#859900"),
      P("Lime", "#272822", "#E6DB74", "#75715E", "#1E1F1C", "#F8F8F2", "#A6E22E", "#F92672")
    ],
    window: codeWindow,
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H, R } = f;
      const p = f.pal;
      const j = f.journey;
      fill(ctx, f, p.bg);
      const bar = CODE.bar * u;
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, bar);
      ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(40 * u + i * 34 * u, bar / 2, 11 * u, 0, Math.PI * 2);
        ctx.fill();
      });
      const file = `${firstName(j.name).toLowerCase().replace(/[^a-z0-9]+/g, "")}_${f.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.tsx`;
      ctx.fillStyle = p.bg;
      ctx.font = F.mono(20 * u, 600);
      const tw = ctx.measureText(file).width + 50 * u;
      ctx.fillRect(160 * u, 12 * u, tw, bar - 12 * u);
      text(ctx, file, 160 * u + tw / 2, bar / 2 + 6 * u, F.mono(20 * u, 600), p.ink);
      dim(ctx, f, () => text(ctx, markOf(f), W - 30 * u, bar / 2, F.mono(18 * u, 700), p.muted, "right"));
      const lh = CODE.line * u;
      const gw = CODE.gutter * u;
      const first = bar + 30 * u;
      const px = 26 * u;
      let n = 1;
      for (let y = first; y < H - CODE.status * u - lh / 2; y += lh) {
        if (y > R.y - lh / 2 && y < R.y + R.h + lh / 2) {
          n++;
          continue;
        }
        text(ctx, String(n++), gw - 26 * u, y, F.mono(20 * u, 500), withA(p.ink, 0.35), "right");
      }
      const kw = p.accent2;
      const s = p.fg;
      const ink = p.ink;
      const maxW = W - gw - 40 * u;
      const ev = f.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (f.brand) {
        const crt = routeFor(f, "code.from");
        codeLine(ctx, gw, first, px, [["import", kw], [" { goodTimes } ", ink], ["from", kw], [` "${ev || "snap"}"`, s], [";", ink]], maxW);
        codeLine(ctx, gw, first + lh, px, [["const", kw], [" trip = { from: ", ink], [`"${crt.from.toLowerCase()}"`, s], [", to: ", ink], [`"${crt.to.toLowerCase()}"`, s], [" };", ink]], maxW);
      } else {
        codeLine(ctx, gw, first, px, [["import", kw], [" { mumbai } ", ink], ["from", kw], [` "${ev}"`, s], [";", ink]], maxW);
        codeLine(ctx, gw, first + lh, px, [["const", kw], [" trip = { from: ", ink], [`"${j.code}"`, s], [", to: ", ink], ['"BOM"', s], [`, km: ${j.km} };`, ink]], maxW);
      }
      codeLine(ctx, gw, first + lh * 2, px, [["return", kw], [" (", ink]], maxW);
      const below = R.y + R.h + 26 * u + lh / 2;
      codeLine(ctx, gw, below, px, [[");", ink]], maxW);
      codeLine(ctx, gw, below + lh, px, [[`// ${f.text}`, p.muted]], maxW);
      dim(ctx, f, () => {
        text(ctx, "// ", gw, below + lh * 2, F.mono(px, 500), p.muted, "left");
        ctx.font = F.mono(px, 500);
        poweredByNow(ctx, f, gw + ctx.measureText("// ").width, below + lh * 2, px * 0.85, p.muted, "left");
      });
      const who = firstName(j.name).replace(/[^A-Za-z0-9]/g, "") || "My";
      codeLine(ctx, gw, below + lh * 3, px, [["export default", kw], [` ${who}s${f.brand ? "Day" : "Week"};`, ink]], maxW);
      const sb = CODE.status * u;
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, H - sb, W, sb);
      const on = onColor(p.accent);
      text(ctx, f.brand ? `\u2387 main  \u25CF  ${f.eventName || "snap"}` : `\u2387 main  \u25CF  ${f.eventName}  \xB7  ${j.km.toLocaleString()} km`, 30 * u, H - sb / 2, F.mono(18 * u, 700), on, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 30 * u, H - sb / 2, F.mono(17 * u, 600), on, "right"));
      ctx.strokeStyle = withA(p.ink, 0.25);
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(R.x - 3 * u, R.y - 3 * u, R.w + 6 * u, R.h + 6 * u);
    }
  },
  lanyard: {
    label: "\u{1FAAA} Lanyard badge",
    group: "For devs",
    palettes: () => [
      P("Blue strap", "#F4F4F1", "#111216", "#6B6F78", "#FFFFFF", "#111216", C.neon, C.neon),
      P("Red strap", "#F4F1F0", "#111216", "#6B6F78", "#FFFFFF", "#111216", "#E03A3A", "#E03A3A"),
      P("Green strap", "#F1F4F1", "#111216", "#6B6F78", "#FFFFFF", "#111216", "#22A06B", "#22A06B"),
      P("Purple strap", "#F3F1F6", "#111216", "#6B6F78", "#FFFFFF", "#111216", "#7B4FC9", "#7B4FC9"),
      P("Black & gold", "#1A1A1D", "#FFFFFF", "#6B6F78", "#FFFFFF", "#111216", "#F2C94C", "#F2C94C")
    ],
    window: (W, H, u) => badgeLayout(W, H, u).R,
    marks: ["tl"],
    back(ctx, f) {
      const { u, W, H } = f;
      const j = f.journey;
      const L = badgeLayout(W, H, u);
      const { badge, info } = L;
      const ink = f.pal.ink;
      const grey = f.pal.muted;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, f.pal.bg);
      bg.addColorStop(1, mix2(f.pal.bg, "#000000", 0.1));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const top = badge.y - 40 * u;
      const cx = W / 2;
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + sx * 150 * u, -10 * u);
        ctx.lineTo(cx + sx * 190 * u, -10 * u);
        ctx.lineTo(cx + sx * 24 * u, top);
        ctx.lineTo(cx - sx * 10 * u, top);
        ctx.closePath();
        ctx.fillStyle = f.pal.accent;
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#B9BDC6";
      ctx.beginPath();
      ctx.roundRect(cx - 34 * u, top - 10 * u, 68 * u, 56 * u, 10 * u);
      ctx.fill();
      ctx.strokeStyle = "#8C919C";
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      ctx.arc(cx, badge.y + 4 * u, 22 * u, Math.PI, 0);
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.22)";
      ctx.shadowBlur = 50 * u;
      ctx.shadowOffsetY = 20 * u;
      ctx.fillStyle = f.pal.paper;
      ctx.beginPath();
      ctx.roundRect(badge.x, badge.y, badge.w, badge.h, 34 * u);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#D9DAD6";
      ctx.beginPath();
      ctx.roundRect(cx - 60 * u, badge.y + 26 * u, 120 * u, 20 * u, 10 * u);
      ctx.fill();
      const hy = badge.y + (L.wide ? 70 : 92) * u;
      text(ctx, f.eventName, badge.x + 44 * u, hy, F.sans(L.wide ? 40 * u : 46 * u, 900), ink, "left");
      text(ctx, f.eventDates, badge.x + badge.w - 44 * u, hy, F.mono(20 * u, 600), grey, "right");
      const look = ROLE_LOOK[j.role] ?? { emoji: "\u2728", color: C.gold };
      const d = Math.min(130 * u, info.w * 0.32);
      const qs = Math.min(190 * u, info.w * 0.36);
      const nameX = L.wide ? info.x : info.x + d + 26 * u;
      const ay = L.wide ? info.y + d / 2 + 10 * u : info.y + d / 2 + 6 * u;
      const ax = info.x + d / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ECECEA";
      ctx.fill();
      ctx.clip();
      const av = j.avatar;
      if (av.kind === "image") {
        const s = Math.max(d / av.image.width, d / av.image.height);
        ctx.drawImage(av.image, ax - av.image.width * s / 2, ay - av.image.height * s / 2, av.image.width * s, av.image.height * s);
      } else text(ctx, av.kind === "emoji" ? av.emoji : av.kind === "initials" ? av.text : firstName(j.name).slice(0, 1).toUpperCase(), ax, ay, F.sans(d * 0.42, 800), ink);
      ctx.restore();
      const ny = L.wide ? ay + d / 2 + 50 * u : ay - 14 * u;
      const nameW = L.wide ? info.w : info.w - d - 26 * u - qs - 20 * u;
      ctx.font = F.sans(46 * u, 900);
      const npx = Math.min(46 * u, 46 * u * nameW / Math.max(1, ctx.measureText(j.name).width));
      text(ctx, j.name, nameX, ny, F.sans(npx, 900), ink, "left");
      if (f.brand) {
        const role = wordOf(f, "lanyard.role") ?? "Guest";
        const org = wordOf(f, "lanyard.org") ?? (f.brand.sponsor ? f.sponsor.name : "");
        if (role) text(ctx, `\u2728 ${role}`, nameX, ny + 44 * u, F.sans(24 * u, 700), grey, "left");
        if (org) text(ctx, org, nameX, ny + 78 * u, F.mono(20 * u, 600), grey, "left");
      } else {
        text(ctx, `${look.emoji} ${j.role}`, nameX, ny + 44 * u, F.sans(24 * u, 700), look.color === C.gold ? grey : look.color, "left");
        text(ctx, j.handle ?? `Traveller #${j.traveller}`, nameX, ny + 78 * u, F.mono(20 * u, 600), grey, "left");
      }
      const link = f.link ?? `https://${j.siteHost}/reel`;
      const qx = L.wide ? info.x : info.x + info.w - qs;
      const qy = L.wide ? info.y + info.h - qs - 120 * u : info.y;
      drawQr(ctx, link, qx, qy, qs, ink);
      text(ctx, "SCAN \xB7 MAKE YOURS", qx + qs / 2, qy + qs + 22 * u, F.mono(14 * u, 700), grey);
      const fy = badge.y + badge.h - 46 * u;
      text(ctx, ticketOf(f), badge.x + 44 * u, fy - 40 * u, F.mono(18 * u, 700), ink, "left");
      poweredBy(ctx, f, badge.x + 44 * u, fy, 20 * u, grey, "left");
      dim(ctx, f, () => text(ctx, signOf(f), badge.x + badge.w - 44 * u, fy, F.mono(16 * u, 500), grey, "right"));
    },
    front(ctx, f) {
      const { R, u } = f;
      const r = 24 * u;
      ctx.save();
      ctx.beginPath();
      ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
      ctx.roundRect(R.x, R.y, R.w, R.h, r);
      ctx.fillStyle = f.pal.paper;
      ctx.fill("evenodd");
      ctx.restore();
    }
  },
  gamecard: {
    label: "\u{1F0CF} Game card",
    group: "Fun",
    palettes: () => [
      P("Your rarity", "#2B1650", "#FFFFFF", "#B9A8CC", "#0F0A22", "#FFFFFF", "#FFE27A", "#FF7AD9"),
      { ...P("Legendary", "#2B1650", "#FFFFFF", "#B9A8CC", "#0F0A22", "#FFFFFF", "#FFE27A", "#FF7AD9"), rarity: "legendary" },
      { ...P("Epic", "#2A1240", "#FFFFFF", "#B9A8CC", "#0E0A1C", "#FFFFFF", "#E9B8FF", "#C77DFF"), rarity: "epic" },
      { ...P("Gold", "#2E2208", "#FFFFFF", "#C9B98A", "#120D04", "#FFFFFF", "#F2C94C", "#FFE08A"), rarity: "rare" },
      { ...P("Silver", "#1E2530", "#FFFFFF", "#AFC3D6", "#0C1016", "#FFFFFF", "#DDE7F2", "#8DA2B8"), rarity: "uncommon" }
    ],
    window: (W, H, u) => gameLayout(W, H, u).R,
    marks: ["tl", "tr"],
    back(ctx, f) {
      const { u, W, H, t } = f;
      const j = f.journey;
      const L = gameLayout(W, H, u);
      const { card, panel } = L;
      const rar = rarFor(f);
      const look = ROLE_LOOK[j.role] ?? { emoji: "\u2728", color: rar.accent };
      fill(ctx, f, "#07060D");
      const glowG = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
      glowG.addColorStop(0, `${rar.foil[0]}38`);
      glowG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowG;
      ctx.fillRect(0, 0, W, H);
      const k = 70 * u;
      ctx.save();
      ctx.shadowColor = `${rar.foil[0]}88`;
      ctx.shadowBlur = 50 * u;
      chamfer(ctx, card, k);
      const body = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + card.h);
      body.addColorStop(0, rar.base[0]);
      body.addColorStop(1, rar.base[1]);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.restore();
      ctx.save();
      chamfer(ctx, card, k);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 2 * u;
      for (let x = card.x - card.h; x < card.x + card.w; x += 18 * u) {
        ctx.beginPath();
        ctx.moveTo(x, card.y + card.h);
        ctx.lineTo(x + card.h, card.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.07;
      text(ctx, look.emoji, panel.x + panel.w / 2, panel.y + panel.h / 2, F.sans(Math.min(panel.w, panel.h) * 0.9, 700), "#FFFFFF");
      ctx.restore();
      const sweep = t * 0.15 % 1 * card.w * 2 - card.w;
      const foil = ctx.createLinearGradient(card.x + sweep, card.y, card.x + sweep + card.w, card.y + card.h);
      rar.foil.forEach((c, i) => foil.addColorStop(i / (rar.foil.length - 1), c));
      ctx.strokeStyle = foil;
      ctx.lineWidth = 14 * u;
      chamfer(ctx, card, k);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2 * u;
      chamfer(ctx, { x: card.x + 16 * u, y: card.y + 16 * u, w: card.w - 32 * u, h: card.h - 32 * u }, k * 0.8);
      ctx.stroke();
      ctx.strokeStyle = foil;
      ctx.lineWidth = 6 * u;
      ctx.strokeRect(L.R.x - 3 * u, L.R.y - 3 * u, L.R.w + 6 * u, L.R.h + 6 * u);
      const s = Math.min(panel.w / 640, panel.h / 250);
      const ox = panel.x + (panel.w - 640 * s) / 2;
      const oy = panel.y + (panel.h - 250 * s) / 2;
      const X = (v) => ox + v * s;
      const Y = (v) => oy + v * s;
      const name = j.name.toUpperCase();
      ctx.font = F.display(60 * s, 900);
      const npx = Math.min(60 * s, 60 * s * 600 * s / Math.max(1, ctx.measureText(name).width));
      text(ctx, name, X(320), Y(40), F.display(npx, 900), "#FFFFFF");
      text(ctx, f.brand ? `${look.emoji} ${(wordOf(f, "gamecard.class") ?? "Party legend").toUpperCase()}` : `${look.emoji} ${j.role.toUpperCase()}${j.handle ? `  \xB7  ${j.handle}` : ""}`, X(320), Y(86), F.mono(20 * s, 800), look.color);
      ctx.fillStyle = foil;
      ctx.fillRect(X(30), Y(118), 580 * s, 2 * s);
      const ev = ` ${f.eventName.toUpperCase()} `;
      ctx.font = F.mono(17 * s, 800);
      const ew = ctx.measureText(ev).width + 24 * s;
      ctx.fillStyle = rar.base[0];
      ctx.fillRect(X(320) - ew / 2, Y(105), ew, 26 * s);
      text(ctx, ev, X(320), Y(119), F.mono(17 * s, 800), rar.accent);
      const from = f.brand ? wordOf(f, "gamecard.power") ?? "Special move: the perfect group selfie" : `Flying in from ${j.city} \xB7 ${j.km.toLocaleString()} km to Mumbai`;
      ctx.font = F.sans(26 * s, 700);
      const fpx = Math.min(26 * s, 26 * s * 600 * s / Math.max(1, ctx.measureText(from).width));
      text(ctx, from, X(320), Y(178), F.sans(fpx, 700), "#FFFFFF");
      text(ctx, f.brand ? ticketOf(f) : `Traveller #${j.traveller} \xB7 ${j.ticket}`, X(320), Y(222), F.mono(18 * s, 700), rar.accent);
      for (let i = 0; i < 9; i++) {
        const px = card.x + (i * 0.618 % 1 * 0.9 + 0.05) * card.w;
        const py = card.y + ((i * 0.382 + 0.11) % 1 * 0.9 + 0.05) * card.h;
        const tw = Math.sin(t * 2.2 + i * 1.7);
        sparkle(ctx, px, py, (10 + i % 3 * 6) * u, Math.max(0, tw) * 0.8);
      }
      bands(ctx, f, "#FFFFFF", rar.accent, "rgba(255,255,255,0.6)", card.y, card.y + card.h);
    },
    front(ctx, f) {
      const { t, u } = f;
      chestOpening(ctx, f);
      const p = t % 4 / 1.1;
      if (p > 1 || t < PACK_BURST) return;
      const L = gameLayout(f.W, f.H, u);
      ctx.save();
      chamfer(ctx, L.card, 70 * u);
      ctx.clip();
      const sx = L.card.x - L.card.w * 0.5 + p * L.card.w * 2;
      const g = ctx.createLinearGradient(sx - L.card.w * 0.2, L.card.y, sx + L.card.w * 0.2, L.card.y + L.card.h * 0.35);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.2)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(L.card.x, L.card.y, L.card.w, L.card.h);
      ctx.restore();
    }
  },
  booth: {
    label: "\u{1F4F7} Photo booth",
    group: "Fun",
    palettes: () => [
      P("White strip", "#1A1A1D", "#FFFFFF", "#9A9AA0", "#FAFAF7", "#2A2A2E", "#FF4F7B", "#FF4F7B"),
      P("Black strip", "#EDE7DD", "#141413", "#6B6A66", "#141414", "#F2F2F2", "#D9480F", "#D9480F"),
      P("Red strip", "#2A0E10", "#FFE5E5", "#C99A9A", "#D62839", "#FFFFFF", "#FFC440", "#FFC440"),
      P("Kraft", "#3A2E22", "#F4E7D3", "#BFA88A", "#D9BF94", "#3A2414", "#FFB020", "#FFB020")
    ],
    window: (W, H, u) => boothLayout(W, H, u).cells[0],
    marks: ["tr"],
    back(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const L = boothLayout(W, H, u);
      fill(ctx, f, p.bg);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 40 * u;
      ctx.shadowOffsetY = 12 * u;
      ctx.fillStyle = p.paper;
      ctx.fillRect(L.strip.x, L.strip.y, L.strip.w, L.strip.h);
      ctx.restore();
      const ph = f.photos ?? [];
      const at = f.seg?.i ?? 0;
      L.cells.slice(1).forEach((c, k) => {
        const img = ph.length > 1 ? ph[(at + 1 + k) % ph.length] : void 0;
        if (img) coverImg(ctx, img, c);
        else {
          ctx.fillStyle = withA(p.ink, 0.12);
          ctx.fillRect(c.x, c.y, c.w, c.h);
        }
      });
      const d = dayOf(f);
      const foot = [firstName(f.journey.name), f.eventName, f.brand && !f.eventDates ? "" : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`].filter(Boolean).join(" \xB7 ");
      ctx.font = `italic 700 ${34 * u}px Georgia, serif`;
      const fpx = Math.min(34 * u, 34 * u * (L.foot.w - 40 * u) / Math.max(1, ctx.measureText(foot).width));
      text(ctx, foot, L.foot.x + L.foot.w / 2, L.foot.y + L.foot.h / 2, `italic 700 ${fpx}px Georgia, serif`, p.ink);
      bands(ctx, f, p.fg, p.accent, p.muted, L.strip.y, L.strip.y + L.strip.h);
    }
  },
  dump: {
    label: "\u{1F5C2}\uFE0F Photo dump",
    group: "Fun",
    palettes: () => [
      P("White", "#FAFAF7", "#141413", "#6B6A66", "#EDEDE8", "#141413", "#FF4F7B", "#FF4F7B"),
      P("Black", "#0E0E10", "#FFFFFF", "#8A8A90", "#1C1C20", "#FFFFFF", "#FFC440", "#FFC440"),
      P("Beige", "#EFE6D8", "#3A2E22", "#7A6A55", "#E2D5C0", "#3A2E22", "#C2410C", "#C2410C"),
      P("Lilac", "#ECE6F7", "#2E2440", "#6A5E80", "#DDD3EE", "#2E2440", "#7B4FC9", "#7B4FC9")
    ],
    window: (W, H, u) => dumpLayout(W, H, u).R,
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const L = dumpLayout(W, H, u);
      fill(ctx, f, p.bg);
      const title = [f.journey.name && `${firstName(f.journey.name)}'s`, f.eventName, "photo dump \u{1F4F8}"].filter(Boolean).join(" ");
      ctx.font = `italic 700 ${48 * u}px Georgia, serif`;
      const tpx = Math.min(48 * u, 48 * u * (W - 100 * u) / Math.max(1, ctx.measureText(title).width));
      text(ctx, title, isWide(W, H) ? 60 * u : W / 2, L.R.y * 0.62, `italic 700 ${tpx}px Georgia, serif`, p.fg, isWide(W, H) ? "left" : "center");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - 50 * u, L.R.y * 0.25, F.mono(18 * u, 700), p.muted, "right"));
      text(ctx, f.eventDates.toUpperCase(), 50 * u, L.R.y * 0.25, F.mono(18 * u, 700), p.muted, "left");
      const ph = f.photos ?? [];
      const g = L.grid;
      const gap = 14 * u;
      const cell = Math.min((g.w - gap * (L.cols - 1)) / L.cols, (g.h - gap * (L.rows - 1)) / L.rows);
      const slots = L.cols * L.rows;
      const at = f.seg?.i ?? -1;
      const startAt = ph.length > slots ? Math.max(0, Math.min(ph.length - slots, at - 1)) : 0;
      for (let k = 0; k < slots; k++) {
        const c = { x: g.x + k % L.cols * (cell + gap), y: g.y + Math.floor(k / L.cols) * (cell + gap), w: cell, h: cell };
        const idx = startAt + k;
        const img = ph[idx];
        ctx.save();
        roundRect(ctx, c, 14 * u);
        ctx.clip();
        if (img) coverImg(ctx, img, c);
        else {
          ctx.fillStyle = p.paper;
          ctx.fillRect(c.x, c.y, c.w, c.h);
        }
        ctx.restore();
        if (img && idx === at) {
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 7 * u;
          roundRect(ctx, c, 14 * u);
          ctx.stroke();
        }
      }
      const fy = H - Math.max(26 * u, (H - (g.y + Math.min(g.h, L.rows * (cell + gap)))) / 2);
      poweredBy(ctx, f, 50 * u, fy, 18 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 50 * u, fy, F.mono(16 * u, 500), p.muted, "right"));
      ctx.save();
      roundRect(ctx, L.R, 22 * u);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();
    },
    front(ctx, f) {
      const { R, u } = f;
      ctx.save();
      ctx.beginPath();
      ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
      ctx.roundRect(R.x, R.y, R.w, R.h, 22 * u);
      ctx.fillStyle = f.pal.bg;
      ctx.fill("evenodd");
      ctx.restore();
    }
  },
  story: {
    label: "\u23F1\uFE0F Story",
    group: "Fun",
    palettes: () => [
      P("Sunset ring", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#FEDA75", "#D62976"),
      P("Ocean ring", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#4FACFE", "#00F2FE"),
      P("Lime ring", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#A8FF78", "#22C55E"),
      P("Mono", "#000000", "#FFFFFF", "#DDDDDD", "#000000", "#FFFFFF", "#FFFFFF", "#8A8A8A")
    ],
    window: banded(0, 0, 0),
    marks: [],
    back(ctx, f) {
      fill(ctx, f, f.pal.bg);
    },
    front(ctx, f) {
      const { u, W, H } = f;
      const p = f.pal;
      const j = f.journey;
      const top = ctx.createLinearGradient(0, 0, 0, 260 * u);
      top.addColorStop(0, "rgba(0,0,0,0.55)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 260 * u);
      const bot = ctx.createLinearGradient(0, H - 260 * u, 0, H);
      bot.addColorStop(0, "rgba(0,0,0,0)");
      bot.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = bot;
      ctx.fillRect(0, H - 260 * u, W, 260 * u);
      const n = Math.max(1, f.seg?.n ?? f.photos?.length ?? 5);
      const x0 = 24 * u;
      const gap = 8 * u;
      const bw = (W - x0 * 2 - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const done2 = f.seg ? i < f.seg.i ? 1 : i === f.seg.i ? f.seg.p : 0 : f.t > f.total / 2 ? 1 : 0;
        const x = x0 + i * (bw + gap);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        roundRect(ctx, { x, y: 28 * u, w: bw, h: 6 * u }, 3 * u);
        ctx.fill();
        if (done2 > 0) {
          ctx.fillStyle = "#FFFFFF";
          roundRect(ctx, { x, y: 28 * u, w: bw * done2, h: 6 * u }, 3 * u);
          ctx.fill();
        }
      }
      const ay = 100 * u;
      const ax = 70 * u;
      const r = 34 * u;
      const ring = ctx.createLinearGradient(ax - r, ay + r, ax + r, ay - r);
      ring.addColorStop(0, p.accent);
      ring.addColorStop(1, p.accent2);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(ax, ay, r + 6 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.fillStyle = "#222";
      ctx.fill();
      ctx.clip();
      const av = j.avatar;
      if (av.kind === "image") coverImg(ctx, av.image, { x: ax - r, y: ay - r, w: r * 2, h: r * 2 });
      else text(ctx, av.kind === "emoji" ? av.emoji : av.kind === "initials" ? av.text : firstName(j.name).slice(0, 1).toUpperCase(), ax, ay, F.sans(r, 800), "#FFFFFF");
      ctx.restore();
      text(ctx, j.handle ?? firstName(j.name), ax + r + 22 * u, ay - 12 * u, F.sans(28 * u, 800), "#FFFFFF", "left");
      text(ctx, titleAt(f), ax + r + 22 * u, ay + 22 * u, F.sans(22 * u, 600), "rgba(255,255,255,0.8)", "left");
      text(ctx, "\u22EF   \u2715", W - 40 * u, ay, F.sans(34 * u, 700), "#FFFFFF", "right");
      const by = H - 80 * u;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.5 * u;
      roundRect(ctx, { x: 30 * u, y: by - 34 * u, w: W - 220 * u, h: 68 * u }, 34 * u);
      ctx.stroke();
      text(ctx, "Send message", 64 * u, by, F.sans(26 * u, 600), "rgba(255,255,255,0.85)", "left");
      text(ctx, "\u2661   \u27A4", W - 40 * u, by, F.sans(40 * u, 700), "#FFFFFF", "right");
      dim(ctx, f, () => {
        poweredByNow(ctx, f, 34 * u, by - 70 * u, 18 * u, "rgba(255,255,255,0.8)", "left");
        text(ctx, markOf(f).toUpperCase(), W - 40 * u, by - 70 * u, F.mono(18 * u, 700), "rgba(255,255,255,0.8)", "right");
      });
    }
  },
  comic: {
    label: "\u{1F4A5} Comic",
    group: "Fun",
    palettes: () => [
      P("Yellow", "#FFD23F", "#111111", "#3A3A3A", "#FFF6C9", "#111111", "#FF3B3B", "#E4572E"),
      P("Cyan", "#3EC1F3", "#111111", "#123A52", "#FFFFFF", "#111111", "#FFD23F", "#1B6FA8"),
      P("Pink", "#FF8FC7", "#111111", "#4A1030", "#FFFFFF", "#111111", "#FFE14D", "#C2185B"),
      P("Lime", "#B6F36B", "#111111", "#21401A", "#FFFFFF", "#111111", "#FF6B35", "#2E7D32")
    ],
    window: (W, H, u) => isWide(W, H) ? capped(170, 150, 60, 1.8)(W, H, u) : capped(270, 240, 70, 1.5)(W, H, u),
    tilt: 0.015,
    marks: ["tl"],
    ownsText: true,
    back(ctx, f) {
      const { u, W, H, R } = f;
      const p = f.pal;
      fill(ctx, f, p.bg);
      ctx.fillStyle = withA(p.accent2, 0.35);
      const step = 30 * u;
      for (let y = 0; y < H + step; y += step)
        for (let x = Math.floor(y / step) % 2 * (step / 2); x < W + step; x += step) {
          const k = 0.15 + 0.85 * ((x / W + y / H) / 2);
          ctx.beginPath();
          ctx.arc(x, y, step * 0.36 * k, 0, Math.PI * 2);
          ctx.fill();
        }
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - 40 * u, 40 * u, F.mono(20 * u, 800), p.ink, "right"));
      text(ctx, f.eventName.toUpperCase(), 40 * u, 40 * u, F.mono(20 * u, 800), p.ink, "left");
      const cap = (wordOf(f, "comic.caption") ?? (placeOf(f) ? `MEANWHILE, IN ${placeOf(f).toUpperCase()}\u2026` : "MEANWHILE\u2026")).toUpperCase();
      if (cap) {
        ctx.font = `italic 900 ${40 * u}px Inter, system-ui, sans-serif`;
        const cw = Math.min(W - 60 * u, ctx.measureText(cap).width + 50 * u);
        const cy = R.y * 0.6;
        ctx.save();
        ctx.translate(W / 2, cy);
        ctx.rotate(-0.02);
        ctx.fillStyle = p.paper;
        ctx.fillRect(-cw / 2, -36 * u, cw, 72 * u);
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 5 * u;
        ctx.strokeRect(-cw / 2, -36 * u, cw, 72 * u);
        text(ctx, cap, 0, 0, `italic 900 ${40 * u}px Inter, system-ui, sans-serif`, p.ink);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
      ctx.rotate(0.015);
      ctx.fillStyle = p.ink;
      ctx.fillRect(-R.w / 2 - 12 * u, -R.h / 2 - 12 * u, R.w + 24 * u, R.h + 24 * u);
      ctx.restore();
      const fy = R.y + R.h + (H - R.y - R.h) * 0.72;
      poweredBy(ctx, f, 40 * u, fy, 20 * u, p.ink, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 40 * u, fy, F.mono(18 * u, 700), p.ink, "right"));
    },
    front(ctx, f) {
      const { u, R, W } = f;
      const p = f.pal;
      const words = f.text.trim();
      if (words) {
        ctx.font = F.sans(38 * u, 900);
        const lines = wrap(ctx, words.toUpperCase(), Math.min(R.w * 0.8, W - 160 * u), 2);
        const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 70 * u;
        const bh = lines.length * 46 * u + 44 * u;
        const bx = R.x + R.w / 2 - bw / 2;
        const by = R.y + R.h - bh * 0.55;
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 5 * u;
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        ctx.moveTo(bx + bw * 0.28, by + 6 * u);
        ctx.lineTo(bx + bw * 0.2, by - 50 * u);
        ctx.lineTo(bx + bw * 0.4, by + 10 * u);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2 - 3 * u, bh / 2 - 3 * u, 0, 0, Math.PI * 2);
        ctx.fill();
        lines.forEach((l, i) => text(ctx, l, bx + bw / 2, by + 22 * u + 23 * u + i * 46 * u, F.sans(38 * u, 900), p.ink));
      }
      if (f.seg) {
        const pop = clamp(f.seg.p / 0.1);
        const sc = pop < 1 ? 0.4 + 0.8 * Math.sin(pop * Math.PI * 0.6) : 1;
        const r = Math.min(150 * u, R.w * 0.2);
        ctx.save();
        ctx.translate(R.x + R.w - r * 0.55, R.y + r * 0.55);
        ctx.rotate(0.12);
        ctx.scale(sc, sc);
        burst(ctx, 0, 0, r, 12, p.accent, p.ink, 5 * u);
        text(ctx, COMIC_WORDS[f.seg.i % COMIC_WORDS.length], 0, 0, `italic 900 ${r * 0.42}px Inter, system-ui, sans-serif`, onColor(p.accent));
        ctx.restore();
      }
    }
  },
  neon: {
    label: "\u{1F303} Neon sign",
    group: "Fun",
    palettes: () => [
      P("Pink & blue", "#0B0710", "#FFFFFF", "#8A7F99", "#140D1C", "#FFFFFF", "#FF3EA5", "#3EC5FF"),
      P("Green & yellow", "#07100B", "#FFFFFF", "#7F9988", "#0C1A12", "#FFFFFF", "#39FF88", "#FFE14D"),
      P("Red & white", "#120606", "#FFFFFF", "#997F7F", "#1C0B0B", "#FFFFFF", "#FF3B3B", "#FFFFFF"),
      P("Purple & cyan", "#0A0714", "#FFFFFF", "#8A82A6", "#130E22", "#FFFFFF", "#B26BFF", "#3EF3E0")
    ],
    window: (W, H, u) => isWide(W, H) ? capped(190, 150, 80, 1.8)(W, H, u) : capped(300, 260, 90, 1.5)(W, H, u),
    marks: ["tr", "br"],
    back(ctx, f) {
      const { u, W, H, R } = f;
      const p = f.pal;
      fill(ctx, f, p.bg);
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 2 * u;
      const bh = 44 * u;
      const bw = 110 * u;
      for (let y = 0, row = 0; y < H; y += bh, row++) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        for (let x = row % 2 * (bw / 2); x < W; x += bw) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
          ctx.stroke();
        }
      }
      const spill = ctx.createRadialGradient(W / 2, R.y + R.h / 2, 0, W / 2, R.y + R.h / 2, Math.max(R.w, R.h) * 0.85);
      spill.addColorStop(0, withA(p.accent, 0.22));
      spill.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spill;
      ctx.fillRect(0, 0, W, H);
      const flick = Math.sin(f.t * 17) > 0.96 ? 0.35 : 1;
      const tpx = Math.min(110 * u, R.y * 0.42);
      const sign = (wordOf(f, "neon.sign") ?? (f.brand ? placeOf(f) || f.eventName || "SNAP" : "MUMBAI")).toUpperCase();
      if (sign) {
        ctx.font = F.display(tpx, 900);
        const spx = Math.min(tpx, tpx * (W - 80 * u) / Math.max(1, ctx.measureText(sign).width));
        glow(ctx, sign, W / 2, R.y * 0.5, F.display(spx, 900), p.accent2, u, flick);
      }
      text(ctx, f.eventName.toUpperCase(), 40 * u, 40 * u, F.mono(18 * u, 700), p.muted, "left");
      dim(ctx, f, () => text(ctx, markOf(f).toUpperCase(), W - 40 * u, 40 * u, F.mono(18 * u, 700), p.muted, "right"));
      const below = R.y + R.h;
      const room = H - below;
      const was = wordOf(f, "neon.below") ?? (f.journey.name ? `${firstName(f.journey.name)} was here` : "We were here");
      if (was) glow(ctx, was, W / 2, below + room * 0.42, `italic 700 ${Math.min(60 * u, room * 0.3)}px Georgia, serif`, p.accent, u);
      poweredBy(ctx, f, 40 * u, H - room * 0.16, 18 * u, p.muted, "left");
      dim(ctx, f, () => text(ctx, creditOf(f), W - 40 * u, H - room * 0.16, F.mono(16 * u, 500), p.muted, "right"));
    },
    front(ctx, f) {
      const { u, R } = f;
      ctx.save();
      ctx.strokeStyle = f.pal.accent;
      ctx.shadowColor = f.pal.accent;
      for (const [lw, blur] of [[10, 40], [6, 18], [3, 0]]) {
        ctx.lineWidth = lw * u;
        ctx.shadowBlur = blur * u;
        if (!blur) ctx.strokeStyle = mix2(f.pal.accent, "#FFFFFF", 0.6);
        roundRect(ctx, { x: R.x - 14 * u, y: R.y - 14 * u, w: R.w + 28 * u, h: R.h + 28 * u }, 26 * u);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
};
var FRAMES = DEFS;
var FRAME_IDS = Object.keys(FRAMES);

// src/engine/upstream/frame-words.ts
var WORD_SLOTS = [
  { id: "newspaper.headline", frame: "newspaper", label: "Headline", max: 40, placeholder: "the photo's caption", sponsor: "edit" },
  { id: "newspaper.story", frame: "newspaper", label: "Story (side columns, wide size)", max: 140, placeholder: "grey lines", sponsor: "edit" },
  { id: "newspaper.ad", frame: "newspaper", label: "Advertisement box", max: 40, placeholder: "the sponsor's logo", sponsor: "fixed" },
  { id: "postcard.message", frame: "postcard", label: "Postcard message", max: 50, placeholder: "Wish you were here!", sponsor: "edit" },
  { id: "magazine.cover", frame: "magazine", label: "Cover line", max: 60, placeholder: "the photo's caption", sponsor: "edit" },
  { id: "comic.caption", frame: "comic", label: "Caption box", max: 28, placeholder: "MEANWHILE\u2026", sponsor: "edit" },
  { id: "neon.sign", frame: "neon", label: "Neon sign", max: 16, placeholder: "the title", sponsor: "fixed" },
  { id: "neon.below", frame: "neon", label: "Line under the photo", max: 30, placeholder: "<name> was here", sponsor: "edit" },
  // the event's pass frames, made general: a route, a gate and seat, a badge, stamps
  { id: "pass.from", frame: "pass", label: "From", max: 14, placeholder: "Home", sponsor: "edit" },
  { id: "pass.to", frame: "pass", label: "To", max: 14, placeholder: "the title", sponsor: "fixed" },
  { id: "pass.gate", frame: "pass", label: "Gate", max: 4, placeholder: "A1", sponsor: "edit" },
  { id: "pass.seat", frame: "pass", label: "Seat", max: 4, placeholder: "VIP", sponsor: "edit" },
  { id: "passport.country", frame: "passport", label: "Country on the cover", max: 28, placeholder: "Republic of <the title>", sponsor: "fixed" },
  { id: "passport.stamps", frame: "passport", label: "Stamps (comma between)", max: 60, placeholder: "Admitted, VIP, Good times, Checked in", sponsor: "edit" },
  { id: "ticket.line", frame: "ticket", label: "Line name", max: 30, placeholder: "<the title> line", sponsor: "fixed" },
  { id: "ticket.from", frame: "ticket", label: "From", max: 14, placeholder: "Home", sponsor: "edit" },
  { id: "ticket.stops", frame: "ticket", label: "Stops (comma between)", max: 40, placeholder: "Photos, Snacks, Dancing", sponsor: "edit" },
  { id: "lanyard.role", frame: "lanyard", label: "Role on the badge", max: 20, placeholder: "Guest", sponsor: "edit" },
  { id: "lanyard.org", frame: "lanyard", label: "Company or club", max: 24, placeholder: "the sponsor's name", sponsor: "edit" },
  { id: "gamecard.class", frame: "gamecard", label: "Class", max: 18, placeholder: "Party legend", sponsor: "edit" },
  { id: "gamecard.power", frame: "gamecard", label: "Special move", max: 40, placeholder: "The perfect group selfie", sponsor: "edit" },
  { id: "code.from", frame: "code", label: "Trip from", max: 14, placeholder: "home", sponsor: "edit" }
];

// src/core/frames-meta.ts
var LOOKS = {
  magazine: { best: "Crowds, stage, night shots", ratio: "9:16", intro: "takeoff", tracks: ["happy", "house", "drive"] },
  gamecard: { best: "Your face, badges, swag", ratio: "9:16", intro: "projector", tracks: ["trap", "drill", "dhol"] },
  lanyard: { best: "People you met, talks", ratio: "9:16", intro: "chime", tracks: ["house", "drive", "glow"] },
  newspaper: { best: "Talks and panels", ratio: "16:9", intro: "chime", tracks: ["drive", "chai", "house"] },
  scrapbook: { best: "Food, streets, the view", ratio: "4:5", intro: "vinyl", tracks: ["rain", "chai", "sunset"] },
  vhs: { best: "Candid, funny photos", ratio: "9:16", intro: "vinyl", tracks: ["synth", "nightbus", "rain"] },
  cinema: { best: "Wide shots", ratio: "16:9", intro: "projector", tracks: ["glow", "synth", "sunset"] },
  story: { best: "Posting to Stories", ratio: "9:16", intro: "none", tracks: ["happy", "trap", "drive"] },
  booth: { best: "Faces, group shots", ratio: "9:16", intro: "vinyl", tracks: ["happy", "dhol", "sunset"] },
  dump: { best: "Lots of photos at once", ratio: "9:16", intro: "takeoff", tracks: ["happy", "house", "trap"] },
  comic: { best: "Funny moments", ratio: "9:16", intro: "projector", tracks: ["dhol", "trap", "happy"] },
  neon: { best: "Nights, parties", ratio: "9:16", intro: "projector", tracks: ["synth", "drill", "nightbus"] },
  passport: { best: "Places you went", ratio: "9:16", intro: "chime", tracks: ["sunset", "drive", "dhol"] },
  ticket: { best: "Getting around", ratio: "9:16", intro: "chime", tracks: ["nightbus", "chai", "drive"] },
  pass: { best: "Arrivals, the city", ratio: "9:16", intro: "takeoff", tracks: ["drive", "glow", "sunset"] },
  code: { best: "Hackathons, demos", ratio: "9:16", intro: "chime", tracks: ["synth", "house", "nightbus"] },
  tablet: { best: "Screens, demos, slides", ratio: "4:5", intro: "chime", tracks: ["house", "synth", "drive"] },
  polaroid: { best: "Friends, selfies", ratio: "4:5", intro: "vinyl", tracks: ["chai", "sunset", "happy"] },
  film: { best: "Moody street photos", ratio: "9:16", intro: "projector", tracks: ["rain", "synth", "glow"] },
  postcard: { best: "Views and landmarks", ratio: "4:5", intro: "chime", tracks: ["sunset", "chai", "rain"] },
  calendar: { best: "Day by day", ratio: "9:16", intro: "chime", tracks: ["drive", "house", "happy"] },
  player: { best: "Your day as a song", ratio: "9:16", intro: "vinyl", tracks: ["glow", "happy", "sunset"] },
  clean: { best: "Anything: lets the photos talk", ratio: "9:16", intro: "takeoff", tracks: ["drive", "happy", "glow"] }
};
var groupLabel = (g) => g === "For devs" ? "Work & tech" : g === "Pizza" ? "Pizza frames" : g;
var strip = (label) => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
var custom = /* @__PURE__ */ new Map();
var ID = /^[a-z][a-z0-9-]{1,30}$/;
function registerFrame(id, def, meta) {
  if (!ID.test(id)) throw new Error(`Frame id "${id}": use 2\u201331 lowercase letters, digits or dashes.`);
  if (id in FRAMES && !custom.has(id)) throw new Error(`"${id}" is a built-in frame.`);
  FRAMES[id] = def;
  if (!FRAME_IDS.includes(id)) FRAME_IDS.push(id);
  custom.set(id, meta);
}
var photosFor = (id, ratio) => custom.get(id)?.photos ?? (id === "booth" ? 4 : id === "dump" ? ratio === "16:9" ? 6 : 8 : 1);
var TOP_PICKS = ["polaroid", "booth", "newspaper", "neon", "magazine", "pass", "postcard", "comic"];
function listFrames() {
  const order = [...TOP_PICKS, ...FRAME_IDS.filter((id) => !TOP_PICKS.includes(id))];
  return order.map((id) => {
    const extra = custom.get(id);
    const look = extra ? { best: extra.best, ratio: extra.ratio, intro: extra.intro ?? "takeoff", tracks: extra.tracks ?? ["happy", "drive", "house"], pack: extra.pack } : LOOKS[id];
    const g = extra?.group ?? FRAMES[id].group;
    return { id, label: strip(FRAMES[id].label), group: groupLabel(g), ...look, photos: photosFor(id, look.ratio) };
  });
}
var isFrameId = (v) => typeof v === "string" && FRAME_IDS.includes(v);

// src/core/credit.ts
var CREDIT_LINE = "QuestPass \xB7 @simarpreet_019";

// src/core/handle.ts
var NETWORKS = {
  telegram: { label: "Telegram", color: "#2AABEE", mark: "\u2708", url: (u) => `https://t.me/${u}` },
  x: { label: "X", color: "#000000", mark: "\u{1D54F}", url: (u) => `https://x.com/${u}` },
  instagram: { label: "Instagram", color: "#E1306C", mark: "\u25CE", url: (u) => `https://instagram.com/${u}` }
};
var isNetwork = (v) => typeof v === "string" && v in NETWORKS;

// src/core/config.ts
var CONFIG_VERSION = 1;
var DEFAULT_COLORS = { accent: "#38FF9C", highlight: "#FFC440", base: "#0E0E0E", text: "#F5F5F0" };
function defaultConfig() {
  return {
    version: CONFIG_VERSION,
    title: "Photo booth",
    place: "",
    dates: "",
    brand: { name: "", website: "", logo: "", colors: { ...DEFAULT_COLORS }, headingFont: "default" },
    showBrand: true,
    frames: { allow: "all", default: "polaroid", first: [] },
    packs: [],
    person: { wholeName: true, nameLabel: "Your name", lineLabel: "Caption", names: [], suggest: { first: [], last: [] }, handle: { ask: false, label: "Your username", networks: ["telegram", "x", "instagram"] }, picture: false },
    words: {},
    video: { enabled: true, qr: true, showBrand: true },
    share: { text: "Made at the photo booth {link}", link: "" },
    camera: { idleSeconds: 30, timer: true },
    maxPhotos: 9
  };
}
var LIMITS = { title: 40, place: 30, dates: 40, name: 40, website: 200, shareText: 280, link: 300, logoBytes: 15e5 };
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var cleanText = (v, max, fallback = "") => typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, " ").trim().slice(0, max) : fallback;
var bool = (v, fallback) => typeof v === "boolean" ? v : fallback;
var num = (v, lo, hi, fallback) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;
var isColor = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
var color = (v, fallback) => isColor(v) ? v.toUpperCase() : fallback;
function cleanUrl(v, max = LIMITS.link, httpsOnly = false) {
  if (typeof v !== "string" || !v.trim() || v.length > max) return "";
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "https:" && (httpsOnly || u.protocol !== "http:")) return "";
    if (u.username || u.password) return "";
    return u.href;
  } catch {
    return "";
  }
}
function cleanLogo(v) {
  if (typeof v !== "string" || !v) return "";
  if (v.startsWith("data:")) {
    return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(v) && v.length <= LIMITS.logoBytes * 4 / 3 + 64 ? v : "";
  }
  return cleanUrl(v, 2e3, true);
}
function migrateConfig(input) {
  const out = { ...input };
  if (out.version === void 0 && isObj(out.colors) && !isObj(out.brand)) {
    out.brand = { colors: out.colors };
    delete out.colors;
  }
  out.version = CONFIG_VERSION;
  return out;
}
function normalizeConfig(input) {
  const d = defaultConfig();
  if (!isObj(input)) return d;
  const c = migrateConfig(input);
  const brand = isObj(c.brand) ? c.brand : {};
  const colors = isObj(brand.colors) ? brand.colors : {};
  const frames = isObj(c.frames) ? c.frames : {};
  const video = isObj(c.video) ? c.video : {};
  const share = isObj(c.share) ? c.share : {};
  const camera = isObj(c.camera) ? c.camera : {};
  const packs = Array.isArray(c.packs) ? [...new Set(c.packs.filter((p) => typeof p === "string" && /^[a-z0-9-]{1,30}$/.test(p)))].slice(0, 10) : [];
  const allowList = Array.isArray(frames.allow) ? [...new Set(frames.allow.filter(isFrameId))] : null;
  const allow = allowList && allowList.length && allowList.length < FRAME_IDS.length ? allowList : "all";
  const offered = allow === "all" ? framesIn(packs) : allow;
  const def = isFrameId(frames.default) && offered.includes(frames.default) ? frames.default : offered.includes(d.frames.default) ? d.frames.default : offered[0];
  const words = {};
  if (isObj(c.words)) {
    for (const slot of WORD_SLOTS) {
      const w = c.words[slot.id];
      if (!isObj(w)) continue;
      const mode = w.mode === "fixed" || w.mode === "edit" || w.mode === "off" ? w.mode : slot.sponsor;
      words[slot.id] = { mode, text: cleanText(w.text, slot.max) };
    }
  }
  const person = isObj(c.person) ? c.person : {};
  const suggest = isObj(person.suggest) ? person.suggest : {};
  const handle = isObj(person.handle) ? person.handle : {};
  const list = (v, max, each) => Array.isArray(v) ? [...new Set(v.map((x) => cleanText(x, each)).filter(Boolean))].slice(0, max) : [];
  return {
    version: CONFIG_VERSION,
    title: cleanText(c.title, LIMITS.title, d.title),
    place: cleanText(c.place, LIMITS.place),
    dates: cleanText(c.dates, LIMITS.dates),
    brand: {
      name: cleanText(brand.name, LIMITS.name),
      website: cleanUrl(brand.website, LIMITS.website),
      logo: cleanLogo(brand.logo),
      colors: {
        accent: color(colors.accent, d.brand.colors.accent),
        highlight: color(colors.highlight, d.brand.colors.highlight),
        base: color(colors.base, d.brand.colors.base),
        text: color(colors.text, d.brand.colors.text)
      },
      headingFont: brand.headingFont === "condensed" ? "condensed" : "default"
    },
    showBrand: bool(c.showBrand, d.showBrand),
    frames: { allow, default: def, first: Array.isArray(frames.first) ? [...new Set(frames.first.filter((id) => isFrameId(id) && offered.includes(id)))] : [] },
    packs,
    person: {
      wholeName: bool(person.wholeName, d.person.wholeName),
      nameLabel: cleanText(person.nameLabel, 30, d.person.nameLabel),
      lineLabel: cleanText(person.lineLabel, 30, d.person.lineLabel),
      names: list(person.names, 5e3, 40),
      suggest: { first: list(suggest.first, 500, 20), last: list(suggest.last, 500, 20) },
      handle: {
        ask: bool(handle.ask, d.person.handle.ask),
        label: cleanText(handle.label, 30, d.person.handle.label),
        networks: Array.isArray(handle.networks) && handle.networks.filter(isNetwork).length ? [...new Set(handle.networks.filter(isNetwork))] : d.person.handle.networks
      },
      picture: bool(person.picture, d.person.picture)
    },
    words,
    video: { enabled: bool(video.enabled, d.video.enabled), qr: bool(video.qr, d.video.qr), showBrand: bool(video.showBrand, d.video.showBrand) },
    share: { text: cleanText(share.text, LIMITS.shareText, d.share.text), link: cleanUrl(share.link, LIMITS.link, true) },
    camera: { idleSeconds: num(camera.idleSeconds, 10, 120, d.camera.idleSeconds), timer: bool(camera.timer, d.camera.timer) },
    maxPhotos: num(c.maxPhotos, 1, 20, d.maxPhotos)
  };
}
var framesIn = (packs) => listFrames().filter((f) => !f.pack || packs.includes(f.pack)).map((f) => f.id);
function offeredFrames(c) {
  const all = c.frames.allow === "all" ? framesIn(c.packs) : c.frames.allow;
  return [...c.frames.first.filter((id) => all.includes(id)), ...all.filter((id) => !c.frames.first.includes(id))];
}
function registerWordSlot(slot) {
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(slot.id)) throw new Error(`Text space id "${slot.id}": use frame.name`);
  if (WORD_SLOTS.some((s) => s.id === slot.id)) return;
  WORD_SLOTS.push({ id: slot.id, frame: slot.frame, label: slot.label, max: Math.min(200, slot.max), placeholder: slot.placeholder, sponsor: slot.defaultMode });
}
var listWordSlots = () => WORD_SLOTS.map((s) => ({ id: s.id, frame: s.frame, label: s.label, max: s.max, placeholder: s.placeholder, defaultMode: s.sponsor }));
var shareTextOf = (c) => (c.share.text.includes("{link}") ? c.share.text.replaceAll("{link}", c.share.link) : `${c.share.text} ${c.share.link}`).replace(/\s+/g, " ").trim();

// src/packs/pizza.ts
var PIZZA_PACK = "pizza";
var GROUP = "Pizza";
var P2 = (name, bg, fg, muted, paper, ink, accent, accent2) => ({ name, bg, fg, muted, paper, ink, accent, accent2 });
var wide = (W, H) => W > 1.3 * H;
var tallness = (W, H) => H / W;
var BEBAS = (px) => `400 ${px}px "Bebas Neue", Impact, "Arial Narrow", sans-serif`;
var MONO = (px) => F.mono(px, 700);
var MONO_LIGHT = (px) => F.mono(px, 500);
var SERIF_I = (px) => `italic 600 ${px}px Georgia, "Times New Roman", serif`;
var HAND = (px) => `700 ${px}px Caveat, "Comic Sans MS", cursive`;
var CINZEL = (px) => `900 ${px}px Cinzel, Georgia, serif`;
var SANS = (px) => F.sans(px, 700);
var word = (f, id, fallback) => {
  const w = f.words?.[id];
  return w === void 0 ? fallback : w;
};
var nameOf = (f) => f.journey.name.trim();
var lineOf = (f) => (f.text ?? "").trim();
var placeDate = (f) => [f.brand?.place, f.eventDates].filter(Boolean).join(" \xB7 ");
function say(ctx, s, x, y, maxW, px, font, color2, align = "center") {
  if (!s) return;
  let size = px;
  ctx.font = font(size);
  while (size > px * 0.5 && ctx.measureText(s).width > maxW) {
    size *= 0.94;
    ctx.font = font(size);
  }
  let out = s;
  while (out.length > 1 && ctx.measureText(out).width > maxW) out = out.slice(0, -2) + "\u2026";
  text(ctx, out, x, y, font(size), color2, align);
}
function stack(ctx, lines, box, align = "center") {
  const shown = lines.filter((l) => l.s);
  const total = shown.reduce((t, l) => t + l.px * 1.22 + (l.gap ?? 0), 0);
  if (!total || box.h <= 0) return;
  const k = Math.min(1, box.h / total);
  let y = box.y + (box.h - total * k) / 2;
  for (const l of shown) {
    const px = l.px * k;
    y += px * 0.61;
    say(ctx, l.s, align === "center" ? box.x + box.w / 2 : box.x, y, box.w, px, l.font, l.color, align);
    y += px * 0.61 + (l.gap ?? 0) * k;
  }
}
function logo(ctx, f, cx, y, h) {
  if (!f.brand?.sponsor) return 0;
  const probe = document.createElement("canvas").getContext("2d");
  const w = probe ? drawSponsorLogo(probe, f.sponsor, 0, 0, h) : 0;
  if (w <= 0) return 0;
  sponsorLogo(ctx, f.sponsor, cx - w / 2, y, h);
  return h;
}
function credit(ctx, f, color2) {
  ctx.save();
  ctx.globalAlpha = Math.max(ctx.globalAlpha, 0.85);
  text(ctx, f.brand?.credit || CREDIT_LINE, f.W - 28 * f.u, f.H - 26 * f.u, MONO(20 * f.u), color2, "right");
  ctx.restore();
}
function mat(ctx, R, pad, fill2, stroke, line = 0) {
  ctx.fillStyle = fill2;
  ctx.fillRect(R.x - pad, R.y - pad, R.w + pad * 2, R.h + pad * 2);
  if (stroke && line) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.strokeRect(R.x - pad + line / 2, R.y - pad + line / 2, R.w + pad * 2 - line, R.h + pad * 2 - line);
  }
}
function seeded(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = s * 1103515245 + 12345 & 2147483647;
    return s / 2147483647;
  };
}
var hash = (s) => [...s].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 7);
var boxBands = (W, H) => {
  const t = tallness(W, H);
  return t >= 1.5 ? [470, 430] : t >= 1.2 ? [330, 320] : [250, 240];
};
var pizzaBox = {
  label: "\u{1F355} Pizza box",
  group: GROUP,
  palettes: () => [
    P2("Kraft", "#C9965B", "#B3261E", "#7A5530", "#F4E6CC", "#3B2412", "#D7262B", "#1E7B34"),
    P2("White box", "#EFE9DD", "#C8262B", "#8C8478", "#FFFFFF", "#2A2622", "#C8262B", "#1E7B34"),
    P2("Black box", "#151515", "#FFD23D", "#8A8A8A", "#222222", "#FEFDFA", "#FF393A", "#FFD23D")
  ],
  window(W, H, u) {
    if (wide(W, H)) return { x: 120 * u, y: 110 * u, w: W * 0.56 - 120 * u, h: H - 220 * u };
    const [top, bottom] = boxBands(W, H);
    return { x: 120 * u, y: top * u, w: W - 240 * u, h: H - (top + bottom) * u };
  },
  ownsText: true,
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = withA(pal.ink, 0.035);
    for (let y = 0; y < H; y += 14 * u) ctx.fillRect(0, y, W, 3 * u);
    ctx.strokeStyle = withA(pal.ink, 0.25);
    ctx.lineWidth = 6 * u;
    const e = 28 * u;
    ctx.strokeRect(e, e, W - 2 * e, H - 2 * e);
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[e, e, 1, 1], [W - e, e, -1, 1], [e, H - e, 1, -1], [W - e, H - e, -1, -1]]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 70 * u, y + dy * 70 * u);
    }
    ctx.stroke();
    for (const [x, y, r2] of [[W * 0.84, H * 0.1, 130 * u], [W * 0.12, H * 0.92, 95 * u]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r2);
      g.addColorStop(0, withA(mix2(pal.bg, "#000000", 0.5), 0.22));
      g.addColorStop(1, withA(pal.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r2, y - r2, r2 * 2, r2 * 2);
    }
    mat(ctx, R, 16 * u, pal.paper, pal.fg, 6 * u);
    const top = wide(W, H) ? { x: R.x + R.w + 60 * u, y: 90 * u, w: W - R.x - R.w - 150 * u, h: H * 0.45 } : { x: 120 * u, y: 40 * u, w: W - 240 * u, h: R.y - 70 * u };
    const r = Math.min(95 * u, top.h * 0.28);
    const cx = top.x + top.w / 2;
    const cy = top.y + r + top.h * 0.04;
    ctx.fillStyle = pal.fg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    const seal = word(f, "pizza-box.top", "HOT & FRESH").toUpperCase();
    const parts = seal.includes(" & ") ? [seal.split(" & ")[0], `& ${seal.split(" & ")[1]}`] : [seal];
    parts.forEach((p, i) => say(ctx, p, cx, cy + (i - (parts.length - 1) / 2) * r * 0.5, r * 1.4, r * 0.48, BEBAS, pal.paper));
    say(ctx, f.eventName.toUpperCase(), cx, cy + r + (top.h - 2 * r) * 0.5, top.w, Math.min(120 * u, top.h * 0.36), BEBAS, pal.fg);
    if (!wide(W, H)) text(ctx, "THIS SIDE UP \u2191", 52 * u, 70 * u, MONO_LIGHT(18 * u), withA(pal.ink, 0.45), "left");
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const box = wide(W, H) ? { x: R.x + R.w + 60 * u, y: H * 0.52, w: W - R.x - R.w - 150 * u, h: H * 0.4 } : { x: 120 * u, y: R.y + R.h + 36 * u, w: W - 240 * u, h: H - (R.y + R.h) - 130 * u };
    stack(ctx, [
      { s: word(f, "pizza-box.to", "DELIVERED TO").toUpperCase(), px: 26 * u, font: MONO, color: withA(pal.ink, 0.6), gap: 6 * u },
      { s: nameOf(f), px: 96 * u, font: BEBAS, color: pal.ink },
      { s: lineOf(f) && `\u201C${lineOf(f)}\u201D`, px: 36 * u, font: SERIF_I, color: pal.ink, gap: 10 * u },
      { s: placeDate(f).toUpperCase(), px: 24 * u, font: MONO, color: pal.fg }
    ], box);
    logo(ctx, f, wide(W, H) ? box.x + box.w / 2 : W / 2, H - 92 * u, 44 * u);
    credit(ctx, f, withA(pal.ink, 0.5));
  }
};
var receiptBands = (W, H) => tallness(W, H) >= 1.5 ? { head: 250, items: 620 } : { head: 190, items: 480 };
function receiptWindow(W, H, u) {
  if (tallness(W, H) < 1.2) {
    const paperW2 = Math.min(W * 0.4, 640 * u);
    return { x: 80 * u, y: 80 * u, w: W - paperW2 - 80 * u - 140 * u, h: H - 160 * u };
  }
  const { head, items } = receiptBands(W, H);
  const paperW = Math.min(W - 200 * u, 820 * u);
  const w = paperW - 110 * u;
  const h = Math.max(260 * u, Math.min(w * 1.15, H - 140 * u - (head + items) * u));
  const y0 = (H - (head * u + h + items * u)) / 2;
  return { x: (W - w) / 2, y: y0 + head * u, w, h };
}
function receiptPaper(ctx, x, y0, w, y1, u, fill2) {
  const tooth = 18 * u;
  ctx.beginPath();
  ctx.moveTo(x, y0 + tooth);
  for (let i = 0, n = Math.ceil(w / (tooth * 2)); i < n; i++) {
    ctx.lineTo(Math.min(x + w, x + i * tooth * 2 + tooth), y0);
    ctx.lineTo(Math.min(x + w, x + (i + 1) * tooth * 2), y0 + tooth);
  }
  ctx.lineTo(x + w, y1 - tooth);
  for (let i = Math.ceil(w / (tooth * 2)); i > 0; i--) {
    ctx.lineTo(Math.max(x, x + i * tooth * 2 - tooth), y1);
    ctx.lineTo(Math.max(x, x + (i - 1) * tooth * 2), y1 - tooth);
  }
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 10 * u;
  ctx.fillStyle = fill2;
  ctx.fill();
  ctx.restore();
}
function dashed(ctx, x0, x1, y, u, color2) {
  ctx.save();
  ctx.strokeStyle = color2;
  ctx.lineWidth = 2.5 * u;
  ctx.setLineDash([10 * u, 8 * u]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.restore();
}
function receiptBody(ctx, f, box, withHeader) {
  const { u, pal } = f;
  const L = box.x;
  const Rx = box.x + box.w;
  const item = (y2, a, b, px2, bold = false) => {
    const font = bold ? MONO : MONO_LIGHT;
    text(ctx, b, Rx, y2, font(px2), pal.ink, "right");
    ctx.font = font(px2);
    say(ctx, a, L, y2, box.w - ctx.measureText(b).width - 24 * u, px2, font, pal.ink, "left");
  };
  const rows = (withHeader ? 3.2 : 0) + 11.2;
  const k = box.h / rows;
  const px = Math.min(28 * u, k * 0.62);
  let y = box.y;
  if (withHeader) {
    const used = logo(ctx, f, L + box.w / 2, y + k * 0.1, Math.min(54 * u, k * 1.1));
    say(ctx, f.eventName.toUpperCase(), L + box.w / 2, y + (used ? k * 1.75 : k * 0.9), box.w, px * 1.25, MONO, pal.ink);
    say(ctx, placeDate(f).toUpperCase(), L + box.w / 2, y + (used ? k * 2.6 : k * 1.9), box.w, px * 0.85, MONO_LIGHT, withA(pal.ink, 0.7));
    y += k * 3.2;
  }
  dashed(ctx, L, Rx, y + k * 0.3, u, withA(pal.ink, 0.5));
  item(y + k * 1.1, word(f, "pizza-receipt.item1", "2 \xD7 LARGE PIZZA"), word(f, "pizza-receipt.price1", "10,000 BTC"), px);
  item(y + k * 2, word(f, "pizza-receipt.item2", "NEW FRENS"), word(f, "pizza-receipt.price2", "PRICELESS"), px);
  dashed(ctx, L, Rx, y + k * 2.7, u, withA(pal.ink, 0.5));
  item(y + k * 3.5, "TOTAL", word(f, "pizza-receipt.price1", "10,000 BTC"), px * 1.25, true);
  say(ctx, word(f, "pizza-receipt.paid", "PAID IN BITCOIN \xB7 22.05.2010"), L + box.w / 2, y + k * 4.5, box.w, px * 0.8, MONO, pal.accent);
  dashed(ctx, L, Rx, y + k * 5.2, u, withA(pal.ink, 0.5));
  say(ctx, nameOf(f) ? `SERVED TO: ${nameOf(f).toUpperCase()}` : "SERVED HOT", L + box.w / 2, y + k * 6.1, box.w, px * 1.1, MONO, pal.ink);
  if (lineOf(f)) say(ctx, `\u201C${lineOf(f)}\u201D`, L + box.w / 2, y + k * 7, box.w, px * 1.05, SERIF_I, pal.ink);
  const rnd = seeded(hash(nameOf(f) + f.eventName));
  const bw = Math.min(box.w * 0.8, 520 * u);
  let bx = L + (box.w - bw) / 2;
  const by = y + k * 7.8;
  ctx.fillStyle = pal.ink;
  while (bx < L + (box.w + bw) / 2) {
    const w = (1 + Math.floor(rnd() * 3)) * 2.4 * u;
    if (rnd() > 0.35) ctx.fillRect(bx, by, w, k * 1.5);
    bx += w + 2.4 * u;
  }
  say(ctx, word(f, "pizza-receipt.footer", "THANK YOU \xB7 PIZZA THE PLANET"), L + box.w / 2, y + k * 10.1, box.w, px * 0.85, MONO, pal.ink);
}
var pizzaReceipt = {
  label: "\u{1F9FE} Bitcoin Pizza receipt",
  group: GROUP,
  palettes: () => [
    P2("Bitcoin orange", "#F7931A", "#1A1A1A", "#6B6B6B", "#FBFAF5", "#1A1A1A", "#D7262B", "#F7931A"),
    P2("Night", "#121212", "#FEFDFA", "#8A8A8A", "#FBFAF5", "#1A1A1A", "#D7262B", "#F7931A"),
    P2("Pizza red", "#B3261E", "#FEFDFA", "#F3B9B4", "#FBFAF5", "#1A1A1A", "#B3261E", "#F7931A")
  ],
  window: receiptWindow,
  ownsText: true,
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let y = 60 * u, row = 0; y < H; y += 150 * u, row++) for (let x2 = row % 2 * 75 * u; x2 < W; x2 += 150 * u) text(ctx, "\u20BF", x2, y, F.sans(48 * u, 800), pal.fg);
    ctx.restore();
    if (tallness(W, H) < 1.2) {
      mat(ctx, R, 14 * u, "#FFFFFF");
      const x2 = R.x + R.w + 60 * u;
      const w2 = W - x2 - 80 * u;
      receiptPaper(ctx, x2, 50 * u, w2, H - 50 * u, u, pal.paper);
      receiptBody(ctx, f, { x: x2 + 40 * u, y: 100 * u, w: w2 - 80 * u, h: H - 200 * u }, true);
      return;
    }
    const { head, items } = receiptBands(W, H);
    const x = R.x - 55 * u;
    const w = R.w + 110 * u;
    const y0 = R.y - head * u;
    const y1 = R.y + R.h + items * u;
    receiptPaper(ctx, x, y0, w, y1, u, pal.paper);
    const hb = { x: x + 55 * u, y: y0 + 40 * u, w: w - 110 * u, h: head * u - 60 * u };
    const used = logo(ctx, f, x + w / 2, hb.y, Math.min(56 * u, hb.h * 0.36));
    stack(ctx, [
      { s: f.eventName.toUpperCase(), px: 36 * u, font: MONO, color: pal.ink },
      { s: placeDate(f).toUpperCase(), px: 22 * u, font: MONO_LIGHT, color: withA(pal.ink, 0.7) }
    ], { ...hb, y: hb.y + (used ? used + 10 * u : 0), h: hb.h - (used ? used + 10 * u : 0) });
    receiptBody(ctx, f, { x: x + 55 * u, y: R.y + R.h + 20 * u, w: w - 110 * u, h: items * u - 60 * u }, false);
  },
  front(ctx, f) {
    credit(ctx, f, withA(f.pal.fg, 0.6));
  }
};
var POSTER = 0.72;
function poster(W, H, u) {
  const h = Math.min(H - 70 * u, (W - 70 * u) / POSTER);
  const w = h * POSTER;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
var pizzaMafia = {
  label: "\u{1F574}\uFE0F Pizza Mafia wanted",
  group: GROUP,
  palettes: () => [
    P2("Old paper", "#2A1A10", "#E9D9B4", "#8B6B4A", "#EAD9B0", "#2B1A0E", "#B3261E", "#2B1A0E"),
    P2("Night", "#0B0B10", "#FEFDFA", "#8A8A8A", "#EFE6D2", "#151515", "#FF393A", "#151515"),
    P2("Red wall", "#7A1712", "#FEFDFA", "#E8B4AE", "#F1E4C8", "#2B1A0E", "#B3261E", "#2B1A0E")
  ],
  window(W, H, u) {
    const p = poster(W, H, u);
    const w = p.w * 0.78;
    return { x: p.x + (p.w - w) / 2, y: p.y + p.h * 0.215, w, h: p.h * 0.42 };
  },
  ownsText: true,
  marks: [],
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const rnd = seeded(11);
    ctx.strokeStyle = withA(mix2(pal.bg, "#000000", 0.5), 0.35);
    ctx.lineWidth = 2 * u;
    for (let i = 0; i < 40; i++) {
      const y = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 40 * u, W * 0.7, y + (rnd() - 0.5) * 40 * u, W, y + (rnd() - 0.5) * 30 * u);
      ctx.stroke();
    }
    const p = poster(W, H, u);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40 * u;
    ctx.shadowOffsetY = 14 * u;
    ctx.fillStyle = pal.paper;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
    const g = ctx.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.35, p.x + p.w / 2, p.y + p.h / 2, p.h * 0.75);
    g.addColorStop(0, withA(pal.paper, 0));
    g.addColorStop(1, withA(mix2(pal.paper, "#5A3A1A", 0.6), 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (const x of [p.x + 26 * u, p.x + p.w - 26 * u]) {
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(x, p.y + 26 * u, 8 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    const cx = p.x + p.w / 2;
    const inner = p.w * 0.86;
    say(ctx, word(f, "pizza-mafia.title", "WANTED").toUpperCase(), cx, p.y + p.h * 0.1, inner, p.h * 0.11, CINZEL, pal.ink);
    say(ctx, `BY THE ${(f.eventName || "PIZZA MAFIA").toUpperCase()}`, cx, p.y + p.h * 0.185, inner, p.h * 0.026, MONO, pal.accent);
    mat(ctx, R, 10 * u, pal.ink);
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const p = poster(W, H, u);
    const cx = p.x + p.w / 2;
    const inner = p.w * 0.86;
    stack(ctx, [
      { s: nameOf(f).toUpperCase() || "THE DON", px: p.h * 0.075, font: BEBAS, color: pal.ink },
      { s: lineOf(f) && `a.k.a. \u201C${lineOf(f)}\u201D`, px: p.h * 0.03, font: SERIF_I, color: pal.ink, gap: p.h * 0.012 },
      { s: word(f, "pizza-mafia.crime", "FOR STEALING THE LAST SLICE").toUpperCase(), px: p.h * 0.026, font: MONO, color: pal.ink },
      { s: word(f, "pizza-mafia.reward", "REWARD: ONE LARGE PEPPERONI").toUpperCase(), px: p.h * 0.032, font: BEBAS, color: pal.accent }
    ], { x: cx - inner / 2, y: R.y + R.h + p.h * 0.02, w: inner, h: p.y + p.h * 0.9 - (R.y + R.h) });
    const pd = placeDate(f).toUpperCase();
    const used = logo(ctx, f, cx, p.y + p.h - p.h * 0.075, p.h * 0.035);
    if (!used && pd) say(ctx, pd, cx, p.y + p.h - p.h * 0.05, inner, p.h * 0.022, MONO, withA(pal.ink, 0.7));
    const stamp2 = word(f, "pizza-mafia.stamp", "PIZZA MAFIA").toUpperCase();
    if (stamp2) {
      const r = Math.min(R.w, R.h) * 0.2;
      ctx.save();
      ctx.translate(R.x + R.w - r * 0.7, R.y + R.h - r * 0.55);
      ctx.rotate(-0.26);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      say(ctx, stamp2, 0, -r * 0.12, r * 1.4, r * 0.32, BEBAS, pal.accent);
      say(ctx, "MEMBER", 0, r * 0.3, r * 1.2, r * 0.2, MONO, pal.accent);
      ctx.restore();
    }
    credit(ctx, f, withA(pal.fg, 0.6));
  }
};
function pizzaGeo(W, H, u) {
  if (wide(W, H)) {
    const s2 = H * 0.8;
    return { s: s2, cx: W * 0.36, cy: H / 2 };
  }
  const t = tallness(W, H);
  const s = t >= 1.5 ? Math.min(W * 0.86, H * 0.55) : t >= 1.2 ? Math.min(W * 0.74, H * 0.6) : H * 0.62;
  return { s, cx: W / 2, cy: t >= 1.5 ? H * 0.46 : H * 0.48 };
  void u;
}
function board(ctx, f) {
  const { W, H, u, pal } = f;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(5);
  ctx.strokeStyle = withA(mix2(pal.bg, "#000000", 0.6), 0.22);
  ctx.lineWidth = 2.2 * u;
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rnd() - 0.5) * 60 * u, H * 0.3, x + (rnd() - 0.5) * 60 * u, H * 0.7, x + (rnd() - 0.5) * 40 * u, H);
    ctx.stroke();
  }
}
var pizzaWhole = {
  label: "\u{1F355} Whole pizza",
  group: GROUP,
  palettes: () => [
    P2("Wood board", "#6B4226", "#FEFDFA", "#E8C9A0", "#F3E2C3", "#2A1A10", "#C7362D", "#3E7B2E"),
    P2("Pizza red", "#B3261E", "#FEFDFA", "#F3B9B4", "#F3E2C3", "#2A1A10", "#FFD23D", "#3E7B2E"),
    P2("Night", "#0B0B10", "#FEFDFA", "#8A8A8A", "#F3E2C3", "#2A1A10", "#FF393A", "#3E7B2E")
  ],
  window(W, H, u) {
    const { s, cx, cy } = pizzaGeo(W, H, u);
    return { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
  },
  ownsText: true,
  marks: [],
  back(ctx, f) {
    board(ctx, f);
    const { R } = f;
    const g = ctx.createRadialGradient(R.x + R.w / 2, R.y + R.h / 2 + R.h * 0.04, R.w * 0.4, R.x + R.w / 2, R.y + R.h / 2 + R.h * 0.04, R.w * 0.6);
    g.addColorStop(0, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(R.x - R.w * 0.2, R.y - R.h * 0.2, R.w * 1.4, R.h * 1.5);
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const cx = R.x + R.w / 2;
    const cy = R.y + R.h / 2;
    const rOut = R.w / 2;
    const crust = R.w * 0.075;
    const rIn = rOut - crust;
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x - 2, R.y - 2, R.w + 4, R.h + 4);
    ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
    ctx.clip("evenodd");
    board(ctx, f);
    ctx.restore();
    const g = ctx.createRadialGradient(cx, cy, rIn, cx, cy, rOut);
    g.addColorStop(0, "#C9853F");
    g.addColorStop(0.45, "#E2AE62");
    g.addColorStop(1, "#A8642A");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
    ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    const rnd = seeded(23);
    ctx.fillStyle = "rgba(70,35,10,0.35)";
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rIn + crust * (0.25 + rnd() * 0.5);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, crust * 0.12, crust * 0.07, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(179,38,30,0.85)";
    ctx.lineWidth = R.w * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cy, rIn - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    const at = (deg, k = 0.06) => [cx + Math.cos(deg * Math.PI / 180) * (rIn - R.w * k), cy + Math.sin(deg * Math.PI / 180) * (rIn - R.w * k)];
    for (const deg of [18, 78, 142, 205, 262, 322]) {
      const [x, y] = at(deg);
      const r = R.w * 0.038;
      ctx.fillStyle = "#A3241C";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(90,15,10,0.6)";
      for (const [dx, dy] of [[-0.35, -0.2], [0.3, 0.1], [-0.05, 0.4]]) {
        ctx.beginPath();
        ctx.arc(x + dx * r, y + dy * r, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const deg of [48, 172, 292]) {
      const [x, y] = at(deg, 0.05);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(deg * Math.PI / 180);
      ctx.fillStyle = "#2F7A2A";
      ctx.beginPath();
      ctx.ellipse(0, 0, R.w * 0.036, R.w * 0.018, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = R.w * 3e-3;
      ctx.beginPath();
      ctx.moveTo(-R.w * 0.03, 0);
      ctx.lineTo(R.w * 0.03, 0);
      ctx.stroke();
      ctx.restore();
    }
    for (const deg of [108, 236, 350]) {
      const [x, y] = at(deg, 0.045);
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = R.w * 9e-3;
      ctx.beginPath();
      ctx.arc(x, y, R.w * 0.014, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (wide(W, H)) {
      const box = { x: R.x + R.w + 70 * u, y: 90 * u, w: W - R.x - R.w - 150 * u, h: H - 180 * u };
      stack(ctx, [
        { s: f.eventName.toUpperCase(), px: 96 * u, font: BEBAS, color: pal.fg, gap: 20 * u },
        { s: nameOf(f), px: 80 * u, font: BEBAS, color: pal.accent },
        { s: lineOf(f) && `\u201C${lineOf(f)}\u201D`, px: 38 * u, font: SERIF_I, color: pal.fg, gap: 14 * u },
        { s: placeDate(f).toUpperCase(), px: 26 * u, font: MONO, color: withA(pal.fg, 0.8) }
      ], box);
      logo(ctx, f, box.x + box.w / 2, H - 110 * u, 46 * u);
    } else {
      say(ctx, f.eventName.toUpperCase(), W / 2, R.y / 2 + 10 * u, W - 160 * u, Math.min(110 * u, R.y * 0.5), BEBAS, pal.fg);
      const used = logo(ctx, f, W / 2, H - 100 * u, 44 * u);
      stack(ctx, [
        { s: nameOf(f), px: 88 * u, font: BEBAS, color: pal.fg },
        { s: lineOf(f) && `\u201C${lineOf(f)}\u201D`, px: 36 * u, font: SERIF_I, color: pal.fg, gap: 10 * u },
        { s: placeDate(f).toUpperCase(), px: 24 * u, font: MONO, color: withA(pal.fg, 0.8) }
      ], { x: 100 * u, y: R.y + R.h + 24 * u, w: W - 200 * u, h: H - (R.y + R.h) - 40 * u - (used ? 120 * u : 30 * u) });
    }
    credit(ctx, f, withA(pal.fg, 0.55));
  }
};
var tableBands = (W, H) => tallness(W, H) >= 1.5 ? [250, 560] : tallness(W, H) >= 1.2 ? [210, 430] : [170, 330];
function gingham(ctx, f) {
  const { W, H, u, pal } = f;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  const step = 108 * u;
  ctx.fillStyle = withA(pal.accent, 0.5);
  for (let x = 0; x < W; x += step) ctx.fillRect(x, 0, step / 2, H);
  for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, step / 2);
}
function chalkboard(ctx, f, b) {
  const { u, pal } = f;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24 * u;
  ctx.shadowOffsetY = 8 * u;
  ctx.fillStyle = pal.accent2;
  roundRect(ctx, b, 14 * u);
  ctx.fill();
  ctx.restore();
  const inner = { x: b.x + 16 * u, y: b.y + 16 * u, w: b.w - 32 * u, h: b.h - 32 * u };
  ctx.fillStyle = pal.paper;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  const rnd = seeded(3);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 260; i++) ctx.fillRect(inner.x + rnd() * inner.w, inner.y + rnd() * inner.h, 3 * u, 3 * u);
  stack(ctx, [
    { s: word(f, "pizza-table.special", "TODAY'S SPECIAL"), px: 46 * u, font: HAND, color: withA(pal.ink, 0.85), gap: 4 * u },
    { s: nameOf(f) || "You", px: 104 * u, font: HAND, color: pal.ink },
    { s: lineOf(f), px: 46 * u, font: HAND, color: withA(pal.ink, 0.9), gap: 8 * u },
    { s: placeDate(f).toUpperCase(), px: 22 * u, font: MONO, color: withA(pal.ink, 0.7) }
  ], { x: inner.x + 30 * u, y: inner.y + 14 * u, w: inner.w - 60 * u, h: inner.h - 28 * u });
}
var pizzaTable = {
  label: "\u{1F377} Pizzeria table",
  group: GROUP,
  palettes: () => [
    P2("Red check", "#FFFFFF", "#C8262B", "#8C8478", "#1F2A24", "#F2F2EA", "#C8262B", "#7A4A26"),
    P2("Blue check", "#FFFFFF", "#2457A6", "#8C8478", "#1F2A24", "#F2F2EA", "#2457A6", "#7A4A26"),
    P2("Green check", "#FFFFFF", "#2E7D32", "#8C8478", "#1F2A24", "#F2F2EA", "#2E7D32", "#7A4A26")
  ],
  window(W, H, u) {
    if (wide(W, H)) return { x: 110 * u, y: 150 * u, w: W * 0.56 - 110 * u, h: H - 260 * u };
    const [top, bottom] = tableBands(W, H);
    return { x: 130 * u, y: top * u, w: W - 260 * u, h: H - (top + bottom) * u };
  },
  ownsText: true,
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    gingham(ctx, f);
    const top = wide(W, H) ? { x: R.x, y: 30 * u, w: R.w, h: R.y - 50 * u } : { x: 100 * u, y: 40 * u, w: W - 200 * u, h: R.y - 80 * u };
    ctx.font = BEBAS(Math.min(90 * u, top.h * 0.62));
    const tw = Math.min(top.w, ctx.measureText(f.eventName.toUpperCase()).width + 80 * u);
    const label = { x: top.x + (top.w - tw) / 2, y: top.y + top.h * 0.12, w: tw, h: top.h * 0.76 };
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 16 * u;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, label, 16 * u);
    ctx.fill();
    ctx.restore();
    say(ctx, f.eventName.toUpperCase(), label.x + label.w / 2, label.y + label.h / 2 + 4 * u, label.w - 40 * u, Math.min(90 * u, top.h * 0.6), BEBAS, pal.fg);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 26 * u;
    ctx.shadowOffsetY = 10 * u;
    mat(ctx, R, 22 * u, pal.accent2);
    ctx.restore();
    mat(ctx, R, 6 * u, "#F6EBD9");
  },
  front(ctx, f) {
    const { W, H, u, R } = f;
    if (wide(W, H)) {
      const x = R.x + R.w + 70 * u;
      chalkboard(ctx, f, { x, y: 120 * u, w: W - x - 90 * u, h: H - 240 * u });
      logo(ctx, f, x + (W - x - 90 * u) / 2, H - 100 * u, 40 * u);
    } else {
      const y = R.y + R.h + 50 * u;
      const room = H - y - 50 * u;
      const lh = room > 330 * u ? 50 * u : 0;
      chalkboard(ctx, f, { x: 90 * u, y, w: W - 180 * u, h: room - lh - (lh ? 16 * u : 0) });
      if (lh) logo(ctx, f, W / 2, H - 50 * u - lh + 4 * u, 40 * u);
    }
    credit(ctx, f, "rgba(0,0,0,0.55)");
  }
};
var RARITIES = [
  { name: "Common", color: "#9CA3AF", weight: 34 },
  { name: "Uncommon", color: "#34D399", weight: 26 },
  { name: "Rare", color: "#60A5FA", weight: 18 },
  { name: "Super Rare", color: "#A78BFA", weight: 11 },
  { name: "Epic", color: "#F472B6", weight: 7 },
  { name: "Grail", color: "#FBBF24", weight: 4 }
];
var TRAITS = [
  ["Crust", ["Thin", "Deep dish", "Stuffed", "Neapolitan", "Sourdough", "Pan", "Detroit", "Cauliflower"]],
  ["Sauce", ["Marinara", "Pesto", "White", "BBQ", "Vodka", "Hot honey", "Arrabbiata", "Garlic"]],
  ["Cheese", ["Mozzarella", "Burrata", "Gorgonzola", "Four cheese", "Parmesan", "Ricotta", "Vegan", "Smoked"]],
  ["Topping", ["Pepperoni", "Pineapple", "Mushroom", "Basil", "Jalape\xF1o", "Black olive", "Anchovy", "Truffle", "Hot salami", "Rocket"]]
];
function nftOf(f) {
  const seed = hash(`${nameOf(f).toLowerCase()}|${f.eventName}`);
  const rnd = seeded(seed);
  const number = 1 + Math.floor(rnd() * 1e4);
  const typed = word(f, "pizza-nft.rarity", "").trim().toLowerCase();
  let rarity = RARITIES.find((r) => r.name.toLowerCase() === typed);
  if (!rarity) {
    let roll = rnd() * 100;
    rarity = RARITIES.find((r) => (roll -= r.weight) < 0) ?? RARITIES[0];
  }
  const traits = TRAITS.map(([k, list]) => [k, list[Math.floor(rnd() * list.length)]]);
  return { number, rarity, traits };
}
function nftCard(W, H, u) {
  if (wide(W, H)) {
    const h2 = H - 120 * u;
    return { x: 80 * u, y: 60 * u, w: W - 160 * u, h: h2 };
  }
  const t = tallness(W, H);
  const w = t >= 1.5 ? W - 140 * u : t >= 1.2 ? Math.min(W - 140 * u, (H - 100 * u) * 0.66) : (H - 80 * u) * 0.7;
  const h = t >= 1.5 ? Math.min(H - 220 * u, w * 1.62) : H - (t >= 1.2 ? 100 : 80) * u;
  return { x: (W - w) / 2, y: (H - h) / 2 + (t >= 1.5 ? 30 * u : 0), w, h };
}
function stars(ctx, f) {
  const { W, H, u, pal } = f;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.7);
  g.addColorStop(0, withA(pal.accent2, 0.18));
  g.addColorStop(1, withA(pal.bg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(77);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = withA("#FFFFFF", 0.25 + rnd() * 0.6);
    const r = (0.8 + rnd() * 2.2) * u;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = withA(pal.accent, 0.8);
  ctx.lineWidth = 3 * u;
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = (8 + rnd() * 10) * u;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
  }
}
var pizzaNft = {
  label: "\u{1F0CF} Rare Pizza card",
  group: GROUP,
  palettes: () => [
    P2("Night sky", "#070B1A", "#FEFDFA", "#9AA4BF", "#121A33", "#FEFDFA", "#FFD23D", "#7B5CFF"),
    P2("Pizza red", "#3A0A08", "#FEFDFA", "#E8B4AE", "#1C0D0B", "#FEFDFA", "#FFD23D", "#FF393A"),
    P2("Grail gold", "#141008", "#FFF6DC", "#C9B98A", "#211A0C", "#FFF6DC", "#FBBF24", "#FF8A28")
  ],
  window(W, H, u) {
    const c = nftCard(W, H, u);
    if (wide(W, H)) {
      const s = c.h - 80 * u;
      return { x: c.x + 40 * u, y: c.y + 40 * u, w: s, h: s };
    }
    const w = c.w - 60 * u;
    return { x: c.x + 30 * u, y: c.y + c.h * 0.075, w, h: Math.min(w, c.h * 0.52) };
  },
  ownsText: true,
  marks: [],
  back(ctx, f) {
    const { W, H, u, R, pal } = f;
    stars(ctx, f);
    const c = nftCard(W, H, u);
    const { rarity } = nftOf(f);
    ctx.save();
    ctx.shadowColor = withA(rarity.color, 0.55);
    ctx.shadowBlur = 50 * u;
    ctx.fillStyle = pal.paper;
    roundRect(ctx, c, 28 * u);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rarity.color;
    ctx.lineWidth = 5 * u;
    roundRect(ctx, { x: c.x + 2.5 * u, y: c.y + 2.5 * u, w: c.w - 5 * u, h: c.h - 5 * u }, 26 * u);
    ctx.stroke();
    ctx.fillStyle = "#6B4226";
    roundRect(ctx, { x: R.x - 8 * u, y: R.y - 8 * u, w: R.w + 16 * u, h: R.h + 16 * u }, 14 * u);
    ctx.fill();
    const top = wide(W, H) ? { x: R.x + R.w + 50 * u, y: c.y + 40 * u, w: c.x + c.w - (R.x + R.w) - 90 * u } : { x: c.x + 30 * u, y: c.y + 14 * u, w: c.w - 60 * u };
    const hy = wide(W, H) ? top.y + 26 * u : (c.y + R.y) / 2 + 2 * u;
    const hp = wide(W, H) ? 28 * u : Math.min(28 * u, (R.y - c.y) * 0.42);
    say(ctx, word(f, "pizza-nft.collection", "RARE PIZZA").toUpperCase(), top.x, hy, top.w * 0.6, hp, MONO, pal.accent, "left");
    text(ctx, "1 OF 1", top.x + top.w, hy, MONO(hp * 0.85), withA(pal.ink, 0.6), "right");
  },
  front(ctx, f) {
    const { W, H, u, R, pal } = f;
    const c = nftCard(W, H, u);
    const { number, rarity, traits } = nftOf(f);
    const box = wide(W, H) ? { x: R.x + R.w + 50 * u, y: c.y + 90 * u, w: c.x + c.w - (R.x + R.w) - 90 * u, h: c.h - 130 * u } : { x: c.x + 30 * u, y: R.y + R.h + 22 * u, w: c.w - 60 * u, h: c.y + c.h - (R.y + R.h) - 44 * u };
    const units = 8.6;
    const k = box.h / units;
    const px = Math.min(30 * u, k * 0.5);
    let y = box.y;
    const title = `${nameOf(f) || "Unnamed Pizza"} #${number}`;
    say(ctx, title, box.x, y + k * 0.62, box.w, Math.min(64 * u, k * 1.05), BEBAS, pal.ink, "left");
    y += k * 1.35;
    ctx.font = MONO(px * 0.95);
    const bw = ctx.measureText(rarity.name.toUpperCase()).width + px * 1.6;
    ctx.fillStyle = withA(rarity.color, 0.18);
    roundRect(ctx, { x: box.x, y, w: bw, h: k * 0.85 }, k * 0.42);
    ctx.fill();
    ctx.strokeStyle = rarity.color;
    ctx.lineWidth = 2.5 * u;
    ctx.stroke();
    text(ctx, rarity.name.toUpperCase(), box.x + bw / 2, y + k * 0.44, MONO(px * 0.95), rarity.color);
    if (lineOf(f)) say(ctx, `\u201C${lineOf(f)}\u201D`, box.x + bw + px, y + k * 0.44, box.w - bw - px, px * 1.05, SERIF_I, withA(pal.ink, 0.85), "left");
    y += k * 1.25;
    const cw = (box.w - 14 * u) / 2;
    traits.forEach(([key, value], i) => {
      const x = box.x + i % 2 * (cw + 14 * u);
      const ty = y + Math.floor(i / 2) * k * 1.55;
      ctx.fillStyle = withA(pal.accent2, 0.16);
      roundRect(ctx, { x, y: ty, w: cw, h: k * 1.35 }, 12 * u);
      ctx.fill();
      text(ctx, key.toUpperCase(), x + cw / 2, ty + k * 0.38, MONO(px * 0.7), withA(pal.ink, 0.6));
      say(ctx, value, x + cw / 2, ty + k * 0.92, cw - 16 * u, px * 1.05, SANS, pal.ink);
    });
    y += k * 3.2;
    const minted = ["MINTED AT", f.eventName, placeDate(f)].filter(Boolean).join(" \xB7 ").toUpperCase();
    say(ctx, minted, box.x, y + k * 0.45, box.w * (f.brand?.sponsor ? 0.68 : 1), px * 0.72, MONO, withA(pal.ink, 0.7), "left");
    if (f.brand?.sponsor) {
      const probe = document.createElement("canvas").getContext("2d");
      const lh = Math.min(40 * u, k * 0.8);
      const lw = probe ? drawSponsorLogo(probe, f.sponsor, 0, 0, lh) : 0;
      if (lw > 0) sponsorLogo(ctx, f.sponsor, box.x + box.w - lw, y + k * 0.45 - lh / 2, lh);
    }
    credit(ctx, f, withA(pal.fg, 0.5));
  }
};
var SLOTS = [
  { id: "pizza-box.top", frame: "pizza-box", label: "Seal", max: 20, placeholder: "HOT & FRESH", defaultMode: "fixed" },
  { id: "pizza-box.to", frame: "pizza-box", label: "Above the name", max: 20, placeholder: "DELIVERED TO", defaultMode: "fixed" },
  { id: "pizza-receipt.item1", frame: "pizza-receipt", label: "First item", max: 22, placeholder: "2 \xD7 LARGE PIZZA", defaultMode: "fixed" },
  { id: "pizza-receipt.price1", frame: "pizza-receipt", label: "Its price (and the total)", max: 12, placeholder: "10,000 BTC", defaultMode: "fixed" },
  { id: "pizza-receipt.item2", frame: "pizza-receipt", label: "Second item", max: 22, placeholder: "NEW FRENS", defaultMode: "edit" },
  { id: "pizza-receipt.price2", frame: "pizza-receipt", label: "Its price", max: 12, placeholder: "PRICELESS", defaultMode: "edit" },
  { id: "pizza-receipt.paid", frame: "pizza-receipt", label: "Paid line", max: 32, placeholder: "PAID IN BITCOIN \xB7 22.05.2010", defaultMode: "fixed" },
  { id: "pizza-receipt.footer", frame: "pizza-receipt", label: "Bottom line", max: 32, placeholder: "THANK YOU \xB7 PIZZA THE PLANET", defaultMode: "fixed" },
  { id: "pizza-mafia.title", frame: "pizza-mafia", label: "Headline", max: 12, placeholder: "WANTED", defaultMode: "fixed" },
  { id: "pizza-mafia.crime", frame: "pizza-mafia", label: "The crime", max: 32, placeholder: "FOR STEALING THE LAST SLICE", defaultMode: "edit" },
  { id: "pizza-mafia.reward", frame: "pizza-mafia", label: "Reward", max: 32, placeholder: "REWARD: ONE LARGE PEPPERONI", defaultMode: "edit" },
  { id: "pizza-mafia.stamp", frame: "pizza-mafia", label: "Stamp", max: 14, placeholder: "PIZZA MAFIA", defaultMode: "fixed" },
  { id: "pizza-table.special", frame: "pizza-table", label: "Chalkboard heading", max: 24, placeholder: "TODAY'S SPECIAL", defaultMode: "fixed" },
  { id: "pizza-nft.collection", frame: "pizza-nft", label: "Collection name", max: 20, placeholder: "RARE PIZZA", defaultMode: "fixed" },
  { id: "pizza-nft.rarity", frame: "pizza-nft", label: "Rarity (Common \u2026 Grail; empty: picked from the name)", max: 10, placeholder: "picked from the name", defaultMode: "fixed" }
];
var done = false;
function registerPizzaPack() {
  if (done) return;
  done = true;
  const meta = { pack: PIZZA_PACK, group: "Pizza", tracks: ["happy", "dhol", "house"], ownColors: true };
  registerFrame("pizza-box", pizzaBox, { ...meta, best: "Group shots, the whole party", ratio: "9:16", intro: "takeoff" });
  registerFrame("pizza-receipt", pizzaReceipt, { ...meta, best: "Bitcoin Pizza Day, the origin story", ratio: "9:16", intro: "chime" });
  registerFrame("pizza-mafia", pizzaMafia, { ...meta, best: "Your mafia name, solo shots", ratio: "4:5", intro: "projector", tracks: ["trap", "drill", "dhol"] });
  registerFrame("pizza-whole", pizzaWhole, { ...meta, best: "Faces up close, food shots", ratio: "9:16", intro: "vinyl" });
  registerFrame("pizza-nft", pizzaNft, { ...meta, best: "Your own 1-of-1 Rare Pizza", ratio: "9:16", intro: "projector", tracks: ["trap", "synth", "happy"] });
  registerFrame("pizza-table", pizzaTable, { ...meta, best: "Friends at the table", ratio: "9:16", intro: "vinyl", tracks: ["chai", "sunset", "happy"] });
  for (const s of SLOTS) registerWordSlot(s);
}
registerPizzaPack();

// src/core/version.ts
var VERSION = "1.0.0";
export {
  CONFIG_VERSION,
  PIZZA_PACK,
  VERSION,
  defaultConfig,
  listFrames,
  listWordSlots,
  migrateConfig,
  normalizeConfig,
  offeredFrames,
  shareTextOf
};
