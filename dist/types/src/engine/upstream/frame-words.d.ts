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
import type { Booth } from "../../shims/types";
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
export declare const WORD_SLOTS: WordSlot[];
/** A space's setting for this booth (its own, else the default). */
export declare function wordSetting(booth: Pick<Booth, "slug" | "words">, slot: WordSlot): {
    mode: WordMode;
    text: string;
};
/**
 * What each space shows: off → nothing, fixed → the admin's words, people
 * write → theirs, else the admin's starting text. A space left out shows
 * the frame's own default.
 */
export declare function resolveWords(booth: Pick<Booth, "slug" | "words">, typed: Record<string, string>): Record<string, string>;
/** The spaces people can write in, on one frame. */
export declare const editableSlots: (booth: Pick<Booth, "slug" | "words">, frame: string) => WordSlot[];
