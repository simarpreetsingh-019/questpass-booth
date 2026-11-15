/**
 * The fonts the frames draw with, served with the booth itself (the woff2
 * files in dist/fonts, all under the SIL Open Font License; see
 * dist/fonts/LICENSES.md). Nothing is fetched from a third-party font host,
 * so opening a booth tells no one else who opened it.
 *
 * By default the files are read from the folder next to the booth's script.
 * Self-hosting them elsewhere (or a strict CSP): call setFontsBase(url).
 * setFontsBase(null) turns them off and the frames fall back to system fonts.
 */

type Face = [family: string, file: string, weight: string, style: "normal" | "italic"];

export const FONT_FILES: Face[] = [
  ...["400", "500", "600", "700", "800", "900"].map((w): Face => ["Inter", `inter-latin-${w}-normal.woff2`, w, "normal"]),
  ["Inter", "inter-latin-900-italic.woff2", "900", "italic"],
  ...["500", "600", "700"].map((w): Face => ["IBM Plex Mono", `ibm-plex-mono-latin-${w}-normal.woff2`, w, "normal"]),
  ...["700", "900"].map((w): Face => ["Cinzel", `cinzel-latin-${w}-normal.woff2`, w, "normal"]),
  ["Caveat", "caveat-latin-700-normal.woff2", "700", "normal"],
  ["Permanent Marker", "permanent-marker-latin-400-normal.woff2", "400", "normal"],
  ["Playfair Display", "playfair-display-latin-800-italic.woff2", "800", "italic"],
  ["Bebas Neue", "bebas-neue-latin-400-normal.woff2", "400", "normal"],
];

let base: string | null | undefined;

/** Where the font files are (a folder URL ending in "/"), or null for system fonts only. */
export function setFontsBase(url: string | null) {
  base = url === null ? null : url.endsWith("/") ? url : `${url}/`;
  loading = null;
}

function defaultBase(): string | null {
  try {
    return new URL("./fonts/", import.meta.url).href;
  } catch {
    return null;
  }
}

let loading: Promise<void> | null = null;

/** Register and load every font once (at most 4 s; a font that fails falls back to the next in its stack). */
export function loadBoothFonts(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  loading ??= (async () => {
    const from = base === undefined ? defaultBase() : base;
    if (!from) return;
    const faces = FONT_FILES.map(([family, file, weight, style]) => {
      const face = new FontFace(family, `url("${from}${file}") format("woff2")`, { weight, style, display: "swap" });
      document.fonts.add(face);
      return face.load().catch(() => undefined);
    });
    await Promise.race([Promise.all(faces), new Promise((r) => setTimeout(r, 4000))]);
  })();
  return loading;
}
