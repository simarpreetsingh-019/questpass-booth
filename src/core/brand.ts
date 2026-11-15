/**
 * A BoothConfig as the engine takes it: the brand as the frames' "sponsor"
 * (logo, colours), the booth's own wording (FrameBrand), the video's
 * closing card (OpenReel) and the person (their name only).
 */
import { setActiveSponsor, type SponsorBrand, type SponsorTheme } from "../shims/sponsors";
import { mix } from "../shims/theme";
import type { JourneyInput } from "../shims/journey";
import { applyCanvasTheme, preloadLogoImage } from "../engine/upstream/draw-kit";
import type { FrameBrand } from "../engine/upstream/frames";
import { setWholeNames, type OpenReel } from "../engine/upstream/reel";
import { type BoothColors, type BoothConfig } from "./config";
import { loadBoothFonts } from "./fonts";

import { CREDIT_LINE } from "./credit";

export { CREDIT_LINE };

/** A short, stable id for a string (so a changed logo isn't mistaken for the old one in the engine's caches). */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** The engine's full theme from the booth's four colours. */
export function themeOf(c: BoothColors): SponsorTheme {
  return {
    accent: c.accent,
    accentDark: mix(c.accent, c.base, 0.45),
    accentSoft: mix(c.accent, "#FFFFFF", 0.75),
    highlight: c.highlight,
    highlight2: mix(c.highlight, c.accent, 0.35),
    base: c.base,
    surface: mix(c.base, c.text, 0.08),
    surface2: mix(c.base, c.text, 0.05),
    text: c.text,
  };
}

const hostOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

export function sponsorOf(c: BoothConfig, logo: string): SponsorBrand {
  const name = c.brand.name || c.title;
  return {
    id: `booth-${hash(`${name}|${logo}`)}`,
    name,
    url: c.brand.website || "#",
    wordmark: { src: logo, width: 120, height: 40, alt: name },
    logo: { width: 120, height: 40, mark: [], word: [], markColor: c.brand.colors.accent, wordColor: c.brand.colors.text },
    logoImage: logo || undefined,
    theme: themeOf(c.brand.colors),
    copy: { presentedBy: "Presented by", poweredBy: "by", posterNote: name },
    ownedSlots: [],
    ticketPrefix: "QP",
  };
}

export function frameBrandOf(c: BoothConfig, logo: string): FrameBrand {
  return {
    place: c.place,
    mark: c.brand.name || c.title,
    site: hostOf(c.share.link || c.brand.website),
    credit: CREDIT_LINE,
    sponsor: c.showBrand && Boolean(logo || c.brand.name),
    adLogo: logo || undefined,
  };
}

export function openReelOf(c: BoothConfig): OpenReel {
  const sponsor = c.showBrand && Boolean(c.brand.logo || c.brand.name);
  return { dates: c.dates, sponsor, credit: true, outroQr: c.video.qr && Boolean(c.share.link), outroSponsor: sponsor && c.video.showBrand };
}

/** The person on the frames and the video: just their name, typed in the booth (nothing else is asked). */
export function personOf(name: string, c: BoothConfig): JourneyInput {
  const n = name.trim().slice(0, 30);
  return {
    name: n,
    avatar: n ? { kind: "initials", text: n.slice(0, 1).toUpperCase() } : { kind: "emoji", emoji: "📸" },
    role: "Others",
    city: "",
    country: "",
    lat: 0,
    lng: 0,
    code: "",
    km: 0,
    mode: "by air",
    landing: "",
    eventDates: c.dates,
    ticket: "",
    traveller: 0,
    seat: "",
    siteHost: hostOf(c.share.link),
  };
}

const logos = new Map<string, Promise<string>>();

/**
 * The logo as a data URL the canvas can read: an https logo is fetched once
 * (it must allow CORS, or it is left off: a picture from another site that
 * doesn't allow it would block saving the photo).
 */
export function logoData(src: string): Promise<string> {
  if (!src || src.startsWith("data:")) return Promise.resolve(src);
  let p = logos.get(src);
  if (!p) {
    p = fetch(src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" })
      .then((r) => (r.ok && /^image\/(png|jpeg|webp|gif)/.test(r.headers.get("content-type") ?? "") ? r.blob() : Promise.reject(new Error("logo"))))
      .then((b) => (b.size > 1_500_000 ? "" : new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => res("");
        fr.readAsDataURL(b);
      })))
      .catch(() => "");
    logos.set(src, p);
  }
  return p;
}

/** Everything the engine needs for this config, ready to draw with (fonts, logo, active brand). */
export async function prepare(c: BoothConfig) {
  const logo = await logoData(c.brand.logo);
  const sponsor = sponsorOf(c, logo);
  setActiveSponsor(sponsor);
  applyCanvasTheme(sponsor.theme);
  setWholeNames(c.person.wholeName);
  await Promise.all([loadBoothFonts(), preloadLogoImage(logo || undefined)]);
  return { logo, sponsor, brand: frameBrandOf(c, logo), open: openReelOf(c) };
}

/**
 * Colours for a booth from its logo: the logo's strongest colour becomes the
 * accent, the next distinct one the highlight; a dark backdrop with light
 * text. Null when the logo has no real colour in it (black and white):
 * keep the colours you have then. Runs on the device.
 */
export function colorsFromImage(img: CanvasImageSource): BoothColors | null {
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data;
  const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue;
    const r = d[i]!, gg = d[i + 1]!, b = d[i + 2]!;
    const max = Math.max(r, gg, b);
    const min = Math.min(r, gg, b);
    const sat = max ? (max - min) / max : 0;
    if (sat < 0.25 || max < 50) continue;
    let h = max === r ? ((gg - b) / (max - min)) % 6 : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4;
    h = ((Math.floor(h * 2) % 12) + 12) % 12;
    const bin = bins[h]!;
    const w = sat * sat;
    bin.w += w;
    bin.r += r * w;
    bin.g += gg * w;
    bin.b += b * w;
  }
  const hex = (x: { w: number; r: number; g: number; b: number }) =>
    "#" + [x.r, x.g, x.b].map((v) => Math.round(v / x.w).toString(16).padStart(2, "0")).join("").toUpperCase();
  const ranked = bins.map((b, i) => ({ ...b, i })).filter((b) => b.w >= 1).sort((a, b) => b.w - a.w);
  if (!ranked.length) return null;
  const first = ranked[0]!;
  // the next colour at least 3 hue steps away (not a shade of the first)
  const second = ranked.find((b) => Math.min(Math.abs(b.i - first.i), 12 - Math.abs(b.i - first.i)) >= 3);
  let accent = hex(first);
  if (lightness(accent) < 0.3) accent = mix(accent, "#FFFFFF", 0.35);
  const highlight = second ? hex(second) : mix(accent, "#FFC440", 0.6);
  return { accent: accent.toUpperCase(), highlight: highlight.toUpperCase(), base: mix(accent, "#000000", 0.85).toUpperCase(), text: "#F5F5F0" };
}

function lightness(c: string): number {
  const v = parseInt(c.slice(1), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
}
