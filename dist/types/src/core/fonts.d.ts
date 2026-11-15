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
export declare const FONT_FILES: Face[];
/** Where the font files are (a folder URL ending in "/"), or null for system fonts only. */
export declare function setFontsBase(url: string | null): void;
/** Register and load every font once (at most 4 s; a font that fails falls back to the next in its stack). */
export declare function loadBoothFonts(): Promise<void>;
export {};
