/**
 * The reel's music, synthesised on the device (no files, nothing licensed):
 * a few short loops at a fixed tempo, so every beat time is known exactly
 * and cuts can land on it. Scheduled on an AudioContext that the recorder
 * also captures.
 */
export interface Track {
    id: string;
    name: string;
    bpm: number;
    /** kick pattern on 16th steps of a bar */
    kick: number[];
    snare: number[];
    hat: number[];
    /** bass root per bar (semitones above A1), a 4-bar loop */
    roots: number[];
    /** dhol-style toms instead of a snare */
    dhol?: boolean;
    /** clap instead of a snare */
    clap?: boolean;
    /** an arpeggio over each bar (semitones above the root, on 16th steps) */
    arp?: number[];
    /** pad/lead sound */
    tone?: OscillatorType;
    /**
     * trap / drill: a long distorted 808 on the kicks (drill slides it into the
     * next bar), triplet hat rolls. future / edm: supersaw chord stabs that duck
     * on every kick (the "pumping" sound).
     */
    style?: "trap" | "drill" | "future" | "edm";
    /** chord tones per bar (semitones above that bar's root), a 4-bar loop */
    chords?: number[][];
    /** hat steps that roll (three quick hits) */
    roll?: number[];
    /** a melody on 16th steps, semitones above A1 (null = rest), looped every bar */
    lead?: Array<number | null>;
    /**
     * How the photos follow this track: each photo's length in 16th steps,
     * cycling. The lengths are picked so every cut lands on one of the track's
     * own kicks or snares (and the long ones on a bar), so a different song
     * gives a different rhythm of cuts.
     */
    cuts?: number[];
}
export declare const TRACKS: Track[];
export declare const beatSec: (t: Track) => number;
/** The photo lengths (16th steps) for following `track`; `fast` halves them (for a reel over its limit). */
export declare function cutSteps(track: Track, fast?: boolean): number[];
/**
 * Schedule `track` on `ctx` into `out` from audio time `start` for `dur`
 * seconds, with a beat exactly at `start + phase + k·beat`. Fades out over
 * the last 0.8 s.
 */
export declare function scheduleTrack(ctx: BaseAudioContext, out: AudioNode, track: Track, start: number, dur: number, phase?: number, fadeInAt?: number): void;
/**
 * Waves on a Mumbai beach under the intro: filtered noise that swells and
 * breaks a few times, fading out as the music comes in.
 */
export declare function scheduleWaves(ctx: BaseAudioContext, out: AudioNode, start: number, dur: number): void;
/** A soft low thump with a short airy tail on a photo change, so the cut lands on the beat you hear. */
export declare function scheduleCut(ctx: BaseAudioContext, out: AudioNode, at: number): void;
export type IntroSound = "takeoff" | "chime" | "projector" | "vinyl" | "waves" | "none";
export declare const INTRO_SOUNDS: Array<[IntroSound, string]>;
/** The sound under the reel's intro (`dur` seconds), building into the music. */
export declare function scheduleIntroSound(ctx: BaseAudioContext, out: AudioNode, kind: IntroSound, start: number, dur: number): void;
/** The game card's chest: a whoosh building from `from`, then a burst and a sparkly chime at `burst`. */
export declare function scheduleChest(ctx: BaseAudioContext, out: AudioNode, from: number, burst: number): void;
