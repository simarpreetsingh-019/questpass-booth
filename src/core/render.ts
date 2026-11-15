/**
 * Framed photos and videos, made on the device. Nothing here sends anything
 * anywhere: photos go in, a Blob comes out, and what happens to it (save,
 * share, upload to the host's own gallery) is the host page's choice.
 */
import { FRAMES, paletteFromAccent, paletteFromPhoto, type FrameId, type Palette } from "../engine/upstream/frames";
import { resolveWords } from "../engine/upstream/frame-words";
import { TRACKS, type IntroSound, type Track } from "../engine/upstream/music";
import { MAX_ITEMS, RATIOS, framePalette, previewFrame, recordReel, type Quality, type Ratio, type ReelInput, type ReelItem } from "../engine/upstream/reel";
import { normalizeConfig, offeredFrames, type BoothConfig } from "./config";
import { personOf, prepare } from "./brand";
import { frameMeta, ownColors, photosFor } from "./frames-meta";
import { cleanHandle, drawTag, isNetwork, type Network } from "./handle";
import { setFrameOverlay } from "../engine/upstream/reel";

// the name tag (picture, @username) goes over every frame
setFrameOverlay(drawTag);

export type { FrameId, Ratio, Quality, IntroSound };
export const RATIO_SIZES = RATIOS;

/** Anything a photo can come from. */
export type PhotoSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | Blob;

/** The frame's colours: the brand's, made from the first photo, or one of the frame's own sets (by number). */
export type PaletteChoice = "brand" | "photo" | number;

export interface FrameOptions {
  /** the booth's settings (any JSON; it is checked and completed first) */
  config: BoothConfig | unknown;
  /** the photos, the main one first (multi-photo frames use the rest too) */
  photos: PhotoSource[];
  frame?: FrameId;
  ratio?: Ratio;
  palette?: PaletteChoice;
  /** what the person typed in the frame's text spaces they may fill in, by slot id */
  words?: Record<string, string>;
  /** their name (optional, shown on some frames) */
  name?: string;
  /** the photo's caption */
  caption?: string;
  /** their picture (a profile picture, an NFT): in the name tag on every frame, and on frames that show one */
  avatar?: PhotoSource;
  /** their username, in the name tag on every frame */
  handle?: { network: Network; username: string };
}

/** Big photos are shrunk to this on their long side (an HD Story frame is 2160×3840). */
const MAX_SIDE = 4000;

/** A photo as an ImageBitmap the frames can draw (EXIF rotation applied, very big ones shrunk). */
export async function toBitmap(src: PhotoSource, maxSide = MAX_SIDE): Promise<ImageBitmap> {
  let b = src instanceof ImageBitmap ? src : src instanceof Blob ? await createImageBitmap(src, { imageOrientation: "from-image" }) : await createImageBitmap(src);
  if (Math.max(b.width, b.height) > maxSide) {
    const k = maxSide / Math.max(b.width, b.height);
    b = await createImageBitmap(b, { resizeWidth: Math.round(b.width * k), resizeHeight: Math.round(b.height * k), resizeQuality: "high" });
  }
  return b;
}

function paletteOf(cfg: BoothConfig, frame: FrameId, choice: PaletteChoice, first: ImageBitmap | undefined): Palette | number {
  if (choice === "photo" && first) return paletteFromPhoto(framePalette(frame, 0), first);
  if (typeof choice === "number") return Math.max(0, Math.min(FRAMES[frame].palettes().length - 1, Math.round(choice)));
  if (ownColors(frame)) return 0;
  const p = paletteFromAccent(framePalette(frame, 0), cfg.brand.colors.accent, cfg.brand.name || "Brand");
  return { ...p, accent2: cfg.brand.colors.highlight };
}

/** The frame's colour sets, by number (for a picker): name and accent. */
export const framePalettes = (frame: FrameId) => FRAMES[frame].palettes().map((p, i) => ({ index: i, name: p.name, accent: p.accent, bg: p.bg }));

/** Everything the engine draws a still with, for these options. */
async function stillOptions(o: FrameOptions) {
  const cfg = normalizeConfig(o.config);
  const offered = offeredFrames(cfg);
  const frame = o.frame && offered.includes(o.frame) ? o.frame : cfg.frames.default;
  const ratio = o.ratio && o.ratio in RATIOS ? o.ratio : frameMeta(frame).ratio;
  const photos = await Promise.all(o.photos.slice(0, MAX_ITEMS).map((p) => toBitmap(p)));
  const ready = await prepare(cfg);
  const caption = (o.caption ?? "").slice(0, 60);
  const person = personOf(o.name ?? "", cfg);
  if (o.avatar) person.avatar = { kind: "image", image: await toBitmap(o.avatar, 1024) };
  const username = cleanHandle(o.handle?.username);
  if (username && cfg.person.handle.ask) {
    person.handle = `@${username}`;
    person.network = isNetwork(o.handle?.network) ? o.handle.network : undefined;
  }
  return {
    cfg,
    frame,
    ratio,
    photos,
    draw: {
      frame,
      ratio,
      palette: paletteOf(cfg, frame, o.palette ?? "brand", photos[0]),
      journey: person,
      link: cfg.share.link || undefined,
      note: caption,
      text: caption,
      photo: photos[0],
      items: photos.length ? photos.map((image, i) => ({ id: String(i), image }) as ReelItem) : undefined,
      sponsor: ready.sponsor,
      eventName: cfg.title,
      eventDates: cfg.dates,
      brand: ready.brand,
      words: resolveWords({ slug: "booth", words: cfg.words }, o.words ?? {}),
    },
  };
}

/** Draw the framed photo onto `canvas` at `width` pixels across (its height follows the size). */
export async function drawPreview(canvas: HTMLCanvasElement, width: number, o: FrameOptions): Promise<void> {
  const s = await stillOptions(o);
  previewFrame(canvas, width, s.draw);
}

/**
 * The framed photo as an image file. `hd` draws it at twice the size (a
 * Story is 2160×3840), so the photo inside the frame stays sharp.
 */
export async function renderPhoto(o: FrameOptions & { hd?: boolean; type?: "image/jpeg" | "image/png" }): Promise<Blob> {
  const s = await stillOptions(o);
  const c = document.createElement("canvas");
  previewFrame(c, RATIOS[s.ratio][0] * (o.hd ? 2 : 1), s.draw);
  const type = o.type ?? "image/jpeg";
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't make the photo."))), type, o.hd ? 0.93 : 0.88));
}

/** The music, by id (all made in code on the device: nothing licensed, nothing downloaded). */
export const listTracks = () => TRACKS.map((t) => ({ id: t.id, name: t.name, bpm: t.bpm }));
const trackOf = (id: string | undefined): Track => TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;

export interface VideoOptions extends FrameOptions {
  /** the line under the title on the opening card */
  title?: string;
  /** a track id from listTracks() (default: one that suits the frame) */
  track?: string;
  intro?: IntroSound;
  /** each photo's own caption, in the same order as `photos` */
  captions?: string[];
  /** "music": cuts follow the track; "fast": twice as quick */
  timing?: "music" | "fast";
  quality?: Quality;
  onProgress?: (seconds: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * A video of the photos with music: an MP4 (H.264 + AAC) where the browser
 * can encode one, else WebM recorded in real time. About 15–40 s.
 */
export async function makeVideo(o: VideoOptions): Promise<{ blob: Blob; type: string }> {
  if (!o.photos.length) throw new Error("Add at least one photo.");
  const s = await stillOptions({ ...o, photos: [] });
  const meta = frameMeta(s.frame);
  const items: ReelItem[] = [];
  for (const [i, p] of o.photos.slice(0, MAX_ITEMS).entries()) {
    const image = await toBitmap(p, 1920);
    items.push({ id: String(i), image, beats: 4, text: (o.captions?.[i] ?? "").slice(0, 60), fit: "auto", motion: "in", amount: 0.12, focus: { x: 0.5, y: image.height > image.width * 1.1 ? 0.35 : 0.5 } });
  }
  const ready = await prepare(s.cfg);
  const input: ReelInput = {
    ...s.draw,
    items,
    palette: paletteOf(s.cfg, s.frame, o.palette ?? "brand", items[0]?.image),
    track: trackOf(o.track ?? meta.tracks[0]),
    intro: o.intro ?? meta.intro,
    timing: o.timing ?? "music",
    caption: (o.title ?? "").slice(0, 50),
    open: ready.open,
  };
  const canvas = document.createElement("canvas");
  return recordReel(input, canvas, o.onProgress ?? (() => undefined), o.signal, o.quality ?? "high");
}

/** How many photos a frame takes at a size (1 for most; the photo strip 4, the photo dump 6–8). */
export { photosFor };

/**
 * For live previews (the camera inside the frame, 15 times a second):
 * everything is prepared once, then each draw is synchronous. The photos
 * can be ImageBitmaps or canvases (a camera frame).
 */
export async function createPreviewer(o: Omit<FrameOptions, "photos">) {
  const s = await stillOptions({ ...o, photos: [] });
  return {
    frame: s.frame,
    ratio: s.ratio,
    config: s.cfg,
    draw(canvas: HTMLCanvasElement, width: number, photos: Array<ImageBitmap | HTMLCanvasElement>) {
      const bitmaps = photos as ImageBitmap[];
      const palette = o.palette === "photo" && bitmaps[0] ? paletteOf(s.cfg, s.frame, "photo", bitmaps[0]) : s.draw.palette;
      previewFrame(canvas, width, {
        ...s.draw,
        palette,
        photo: bitmaps[0],
        items: bitmaps.length ? bitmaps.map((image, i) => ({ id: String(i), image }) as ReelItem) : undefined,
      });
    },
  };
}
