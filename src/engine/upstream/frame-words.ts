/**
 * Text spaces on the frames that a booth outside the event lets people (or
 * only its admin) fill in: the newspaper's headline, story and ad box, the
 * postcard's message, the magazine's cover line, the comic's caption box,
 * the neon sign, and the event's pass frames made general (a boarding
 * pass from home to the title, a passport's stamps, a train line, a badge,
 * a game card). Each booth sets every space to fixed (the admin's words),
 * people write (a starting text they can change, up to `max` characters)
 * or off. Nothing typed is uploaded; it is only drawn on the phone.
 */
import type { Booth } from "@/types";

export type WordMode = "fixed" | "edit" | "off";

export interface WordSlot {
  id: string;
  frame: string;
  label: string;
  max: number;
  /** what the frame shows when nothing is set */
  placeholder: string;
  /** a sponsor booth's setting until the admin changes it (the public booth: people write all) */
  sponsor: WordMode;
}

export const WORD_SLOTS: WordSlot[] = [
  { id: "newspaper.headline", frame: "newspaper", label: "Headline", max: 40, placeholder: "the photo's caption", sponsor: "edit" },
  { id: "newspaper.story", frame: "newspaper", label: "Story (side columns, wide size)", max: 140, placeholder: "grey lines", sponsor: "edit" },
  { id: "newspaper.ad", frame: "newspaper", label: "Advertisement box", max: 40, placeholder: "the sponsor's logo", sponsor: "fixed" },
  { id: "postcard.message", frame: "postcard", label: "Postcard message", max: 50, placeholder: "Wish you were here!", sponsor: "edit" },
  { id: "magazine.cover", frame: "magazine", label: "Cover line", max: 60, placeholder: "the photo's caption", sponsor: "edit" },
  { id: "comic.caption", frame: "comic", label: "Caption box", max: 28, placeholder: "MEANWHILE…", sponsor: "edit" },
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
  { id: "code.from", frame: "code", label: "Trip from", max: 14, placeholder: "home", sponsor: "edit" },
];

/** A space's setting for this booth (its own, else the default). */
export function wordSetting(booth: Pick<Booth, "slug" | "words">, slot: WordSlot): { mode: WordMode; text: string } {
  const own = booth.words?.[slot.id];
  return { mode: own?.mode ?? (booth.slug === "snap" ? "edit" : slot.sponsor), text: own?.text ?? "" };
}

/**
 * What each space shows: off → nothing, fixed → the admin's words, people
 * write → theirs, else the admin's starting text. A space left out shows
 * the frame's own default.
 */
export function resolveWords(booth: Pick<Booth, "slug" | "words">, typed: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of WORD_SLOTS) {
    const { mode, text } = wordSetting(booth, s);
    const v = mode === "off" ? "" : mode === "fixed" ? text.trim() || undefined : (typed[s.id] ?? text).trim() || undefined;
    if (v !== undefined) out[s.id] = v.slice(0, s.max);
  }
  return out;
}

/** The spaces people can write in, on one frame. */
export const editableSlots = (booth: Pick<Booth, "slug" | "words">, frame: string) => WORD_SLOTS.filter((s) => s.frame === frame && wordSetting(booth, s).mode === "edit");
