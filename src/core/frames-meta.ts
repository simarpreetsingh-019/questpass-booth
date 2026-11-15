/**
 * What each frame is good for, its usual size, and the music and opening
 * sound that suit it. The drawing itself is in src/engine/upstream/frames.ts.
 */
import type { IntroSound } from "../engine/upstream/music";
import type { Ratio } from "../engine/upstream/reel";
import { FRAMES, FRAME_IDS, type FrameId } from "../engine/upstream/frames";

export interface FrameMeta {
  id: FrameId;
  label: string;
  group: string;
  /** a short line on what photos it suits */
  best: string;
  /** its usual size */
  ratio: Ratio;
  /** how many photos it shows at once (1 for most) */
  photos: number;
  intro: IntroSound;
  tracks: string[];
}

const LOOKS: Record<FrameId, Omit<FrameMeta, "id" | "label" | "group" | "photos">> = {
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
  clean: { best: "Anything: lets the photos talk", ratio: "9:16", intro: "takeoff", tracks: ["drive", "happy", "glow"] },
};

const strip = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();

/** How many photos a frame shows at this size. */
export const photosFor = (id: FrameId, ratio: Ratio) => (id === "booth" ? 4 : id === "dump" ? (ratio === "16:9" ? 6 : 8) : 1);

/** Every frame, the most popular first. */
export const TOP_PICKS: FrameId[] = ["polaroid", "booth", "newspaper", "neon", "magazine", "pass", "postcard", "comic"];

export function listFrames(): FrameMeta[] {
  const order = [...TOP_PICKS, ...FRAME_IDS.filter((id) => !TOP_PICKS.includes(id))];
  return order.map((id) => {
    const look = LOOKS[id];
    const g = FRAMES[id].group;
    return { id, label: strip(FRAMES[id].label), group: g === "For devs" ? "Work & tech" : g, ...look, photos: photosFor(id, look.ratio) };
  });
}

export const isFrameId = (v: unknown): v is FrameId => typeof v === "string" && (FRAME_IDS as string[]).includes(v);

export const frameMeta = (id: FrameId): FrameMeta => listFrames().find((f) => f.id === id)!;
