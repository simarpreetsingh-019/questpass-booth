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

export const TRACKS: Track[] = [
  { id: "chai", name: "Chai lo-fi", bpm: 88, kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], roots: [0, 8, 3, 10], cuts: [16, 16, 7, 9] },
  { id: "drive", name: "Marine Drive pop", bpm: 116, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], roots: [0, 5, 7, 3], cuts: [16, 8, 8, 16, 4, 4, 8] },
  { id: "dhol", name: "Dhol drop", bpm: 124, kick: [0, 3, 8, 11], snare: [4, 6, 12, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14], roots: [0, 0, 5, 7], dhol: true, cuts: [11, 5, 8, 8, 16] },
  { id: "house", name: "Bandra house", bpm: 122, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], roots: [0, 3, 5, 10], clap: true, arp: [12, 19, 24, 19], cuts: [16, 8, 8] },
  { id: "synth", name: "Sea Link synthwave", bpm: 100, kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], roots: [0, 8, 5, 7], arp: [12, 15, 19, 24, 19, 15], tone: "square", cuts: [16, 16, 8, 8] },
  { id: "rain", name: "Monsoon lo-fi", bpm: 80, kick: [0, 6, 10], snare: [4, 12], hat: [0, 3, 6, 8, 11, 14], roots: [0, 5, 3, 8], arp: [24, 19], cuts: [16, 16] },
  { id: "sunset", name: "Juhu sunset afrobeat", bpm: 104, kick: [0, 3, 7, 10], snare: [4, 12], hat: [0, 2, 3, 6, 8, 10, 11, 14], roots: [0, 7, 5, 3], clap: true, arp: [19, 24], cuts: [10, 6, 16, 7, 9] },
  // uplifting future bass (big happy chords that pump, a bright pluck melody)
  {
    id: "glow",
    cuts: [16, 16, 8, 8, 4, 4, 8],
    name: "Gateway glow (future bass)",
    bpm: 150,
    style: "future",
    kick: [0, 10],
    snare: [8],
    clap: true,
    hat: [2, 6, 10, 14],
    roll: [15],
    roots: [5, 0, 2, 10],
    chords: [[12, 16, 19, 24], [12, 16, 19, 24], [12, 15, 19, 24], [12, 16, 19, 24]],
    lead: [41, null, 43, null, 45, null, 48, null, 45, null, 43, null, 41, null, 38, null],
  },
  {
    id: "happy",
    cuts: [16, 8, 8, 16, 4, 4, 4, 4],
    name: "Happy hour (EDM)",
    bpm: 128,
    style: "edm",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    clap: true,
    hat: [2, 6, 10, 14],
    roots: [3, 0, 8, 10],
    chords: [[12, 16, 19], [12, 15, 19], [12, 16, 19], [12, 16, 19]],
    lead: [46, null, 46, null, 43, null, null, 48, null, 46, null, 43, null, 39, null, null],
  },
  // trap: half-time snare, rolling hats, a heavy 808, bell melody
  {
    id: "trap",
    cuts: [16, 10, 6, 16, 8, 8],
    name: "Gateway trap",
    bpm: 140,
    style: "trap",
    kick: [0, 7, 10],
    snare: [8],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    roll: [6, 14],
    roots: [0, 8, 3, 10],
    chords: [[12, 15, 19], [12, 16, 19], [12, 16, 19], [12, 16, 19]],
    lead: [36, null, null, 39, null, null, 43, null, 41, null, 39, null, 36, null, null, null],
  },
  {
    id: "nightbus",
    cuts: [16, 10, 6, 16, 16],
    name: "Night bus (melodic trap)",
    bpm: 130,
    style: "trap",
    kick: [0, 3, 10],
    snare: [8],
    hat: [0, 2, 4, 6, 8, 10, 11, 12, 14],
    roll: [14],
    roots: [7, 3, 10, 5],
    chords: [[12, 15, 19], [12, 16, 19], [12, 16, 19], [12, 16, 19]],
    lead: [43, null, 46, null, 48, null, null, 46, null, 43, null, null, 41, null, 43, null],
  },
  // drill: skippy hats, sliding 808, dark keys
  {
    id: "drill",
    cuts: [16, 11, 5, 16, 8, 8],
    name: "Bandra drill",
    bpm: 142,
    style: "drill",
    kick: [0, 11],
    snare: [8],
    hat: [0, 3, 6, 10, 12, 14],
    roll: [7],
    roots: [3, 3, 8, 7],
    chords: [[12, 15, 19], [12, 15, 19], [12, 16, 19], [12, 15, 19]],
    lead: [39, null, null, null, 38, null, null, null, 34, null, null, null, 38, null, null, null],
  },
];

export const beatSec = (t: Track) => 60 / t.bpm;

/** The photo lengths (16th steps) for following `track`; `fast` halves them (for a reel over its limit). */
export function cutSteps(track: Track, fast = false): number[] {
  const c = track.cuts ?? [16, 8, 8];
  return fast ? c.map((x) => Math.max(4, Math.ceil(x / 2))) : c;
}

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}

/** An event already in the past (the preview started the track mid-way): skip it rather than fire it late. */
const past = (ctx: BaseAudioContext, t: number) => t < ctx.currentTime - 0.005;

function kick(ctx: BaseAudioContext, out: AudioNode, t: number, gain = 0.9) {
  if (past(ctx, t)) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.34);
}

function hit(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, type: BiquadFilterType, dur: number, gain: number) {
  if (past(ctx, t)) return;
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + dur + 0.02);
}

function tom(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, gain: number) {
  if (past(ctx, t)) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(hz * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.24);
}

function note(ctx: BaseAudioContext, out: AudioNode, t: number, hz: number, dur: number, type: OscillatorType, gain: number, cutoff: number) {
  if (past(ctx, t)) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const hz = (semi: number) => 55 * Math.pow(2, semi / 12);

let clip: Float32Array | null = null;
/** A long sine 808 with a little grit (so phone speakers hear it), optionally gliding to `to`. */
function bass808(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, dur: number, to?: number) {
  if (past(ctx, t)) return;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  if (to) {
    o.frequency.setValueAtTime(f, t + dur * 0.6);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.95);
  }
  if (!clip) {
    clip = new Float32Array(256);
    for (let i = 0; i < 256; i++) clip[i] = Math.tanh(((i / 255) * 2 - 1) * 2.5);
  }
  const sh = ctx.createWaveShaper();
  sh.curve = clip;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.42, t + 0.01);
  g.gain.setValueAtTime(0.42, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(sh).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A supersaw chord: two slightly detuned saws per tone. */
function saws(ctx: BaseAudioContext, out: AudioNode, t: number, tones: number[], dur: number, gain: number) {
  if (past(ctx, t)) return;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(3200, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  for (const semi of tones)
    for (const d of [-10, 10]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz(semi);
      o.detune.value = d;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
}

/**
 * Schedule `track` on `ctx` into `out` from audio time `start` for `dur`
 * seconds, with a beat exactly at `start + phase + k·beat`. Fades out over
 * the last 0.8 s.
 */
export function scheduleTrack(ctx: BaseAudioContext, out: AudioNode, track: Track, start: number, dur: number, phase = 0, fadeInAt = 0) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  // a slow fade in when the intro has its own sound (the waves), a quick one otherwise
  master.gain.setValueAtTime(0.0001, start + fadeInAt);
  master.gain.linearRampToValueAtTime(0.8, start + fadeInAt + (fadeInAt ? 1.2 : 0.25));
  master.gain.setValueAtTime(0.8, start + Math.max(0.3, dur - 0.8));
  master.gain.linearRampToValueAtTime(0.0001, start + dur);
  master.connect(out);
  const step = beatSec(track) / 4;
  const bar = step * 16;
  let duck: GainNode | null = null;
  if (track.style === "future" || track.style === "edm") {
    duck = ctx.createGain();
    duck.connect(master);
  }
  // first bar starts at or before `start`, aligned to the beat grid
  const first = start + (phase % bar) - bar;
  for (let b0 = first, bi = 0; b0 < start + dur; b0 += bar, bi++) {
    const root = track.roots[((bi % 4) + 4) % 4]!;
    for (let s = 0; s < 16; s++) {
      const t = b0 + s * step;
      if (t < start || t > start + dur) continue;
      const chord = track.chords?.[((bi % 4) + 4) % 4];
      const heavy = track.style === "trap" || track.style === "drill";
      // so a long reel doesn't loop the same 4 bars: every 8th bar the second
      // half drops the kick for a rising snare build, then a crash on the next bar
      const build = bi % 8 === 7 && s >= 8;
      if (build) hit(ctx, master, t, 1500 + (s - 8) * 160, "bandpass", 0.08, 0.1 + (s - 8) * 0.03);
      if (bi > 0 && bi % 8 === 0 && s === 0) hit(ctx, master, t, 6000, "highpass", 0.9, 0.16);
      if (track.kick.includes(s) && !build) {
        kick(ctx, master, t);
        // sidechain: the chords dip on every kick
        if (duck && !past(ctx, t)) {
          duck.gain.setValueAtTime(0.25, t);
          duck.gain.linearRampToValueAtTime(1, t + step * 2.5);
        }
        if (heavy) {
          const ks = track.kick.filter((k) => k > s);
          const len = ((ks[0] ?? 16) - s) * step;
          const nextRoot = track.roots[(((bi + 1) % 4) + 4) % 4]!;
          bass808(ctx, master, t, hz(root), len * 0.95, track.style === "drill" && !ks.length ? hz(nextRoot) : undefined);
        }
      }
      if (build) {
        // the build replaces the snare
      } else if (heavy && track.snare.includes(s)) {
        hit(ctx, master, t, 1900, "bandpass", 0.2, 0.55);
        tom(ctx, master, t, 190, 0.35);
      } else if (track.snare.includes(s)) {
        if (track.dhol) tom(ctx, master, t, s % 8 === 4 ? 180 : 240, 0.5);
        else if (track.clap) for (const d of [0, 0.012, 0.024]) hit(ctx, master, t + d, 1400, "bandpass", 0.12, 0.35);
        else hit(ctx, master, t, 1800, "bandpass", 0.18, 0.45);
      }
      if (track.arp) note(ctx, master, t, hz(root + track.arp[s % track.arp.length]!), step * 0.9, track.tone ?? "triangle", 0.06, 2600);
      if (track.roll?.includes(s)) for (const d of [0, 1, 2]) hit(ctx, master, t + (d * step) / 3, 8000, "highpass", 0.03, 0.1);
      else if (track.hat.includes(s)) hit(ctx, master, t, 7000, "highpass", 0.05, 0.12);
      const ld = track.lead?.[s];
      if (ld != null) {
        // trap: a soft bell; future / edm: a bright pluck
        if (heavy) note(ctx, master, t, hz(ld + 12), step * 3, "sine", 0.09, 6000);
        else note(ctx, master, t, hz(ld), step * 1.6, "square", 0.045, 4200);
      }
      if (chord && (track.style === "future" || track.style === "edm")) {
        // future: chopped 8th-note stabs; edm: off-beat stabs
        const on = track.style === "future" ? s % 2 === 0 : s % 4 === 2;
        if (on && duck) saws(ctx, duck, t, chord.map((c) => root + c), step * 1.7, 0.05);
        if (s % 4 === 0) note(ctx, master, t, hz(root), step * 3.6, "triangle", 0.3, 700);
      } else if (chord && heavy) {
        if (s === 0) for (const c of chord) note(ctx, master, t, hz(root + c), bar * 0.95, "triangle", 0.025, 1200);
      } else {
        if (s % 4 === 0) note(ctx, master, t, hz(root), step * 3.6, "triangle", 0.32, 900);
        if (s === 0) for (const iv of [12, 19, 24]) note(ctx, master, t, hz(root + iv), bar * 0.95, track.tone ?? "sawtooth", 0.035, 1400);
      }
    }
  }
}

/**
 * Waves on a Mumbai beach under the intro: filtered noise that swells and
 * breaks a few times, fading out as the music comes in.
 */
export function scheduleWaves(ctx: BaseAudioContext, out: AudioNode, start: number, dur: number) {
  if (past(ctx, start)) return;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(400, start);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  // a swell every ~2.2 s: rise, break (brighter), wash out
  for (let t = start, i = 0; t + 2.1 < start + dur; t += 2.2, i++) {
    g.gain.linearRampToValueAtTime(0.32, t + 1.1);
    g.gain.linearRampToValueAtTime(0.12, t + 2.1);
    lp.frequency.linearRampToValueAtTime(1500 + (i % 2) * 400, t + 1.2);
    lp.frequency.linearRampToValueAtTime(500, t + 2.1);
  }
  g.gain.linearRampToValueAtTime(0.0001, start + dur);
  src.connect(lp).connect(g).connect(out);
  src.start(start);
  src.stop(start + dur + 0.05);
}

/** A soft low thump with a short airy tail on a photo change, so the cut lands on the beat you hear. */
export function scheduleCut(ctx: BaseAudioContext, out: AudioNode, at: number) {
  if (past(ctx, at)) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, at);
  o.frequency.exponentialRampToValueAtTime(50, at + 0.18);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.35, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.3);
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5000;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, at);
  ng.gain.linearRampToValueAtTime(0.06, at + 0.01);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  n.connect(hp).connect(ng).connect(out);
  n.start(at);
  n.stop(at + 0.25);
}

/* ------------------------------------------------------------ intro sounds */

export type IntroSound = "takeoff" | "chime" | "projector" | "vinyl" | "waves" | "none";
export const INTRO_SOUNDS: Array<[IntroSound, string]> = [
  ["takeoff", "✈️ Take-off"],
  ["chime", "🔔 Airport chime"],
  ["projector", "🎞 Film projector"],
  ["vinyl", "💿 Vinyl crackle"],
  ["waves", "🌊 Waves"],
  ["none", "🔇 None"],
];

function noiseSrc(ctx: BaseAudioContext, t: number, end: number) {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.loop = true;
  s.start(Math.max(t, ctx.currentTime));
  s.stop(end);
  return s;
}

/** A rising whoosh that builds into the beat at `end`. */
function riser(ctx: BaseAudioContext, out: AudioNode, start: number, end: number) {
  if (past(ctx, end)) return;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(400, start);
  f.frequency.exponentialRampToValueAtTime(7000, end);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.22, end - 0.05);
  g.gain.linearRampToValueAtTime(0.0001, end);
  noiseSrc(ctx, start, end + 0.05).connect(f).connect(g).connect(out);
}

/** A bell: a sine with two inharmonic partials, ringing out. */
function bell(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, gain: number) {
  if (past(ctx, t)) return;
  for (const [k, a] of [[1, 1], [2.76, 0.35], [5.4, 0.12]] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = f * k;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain * a, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / k + 0.4);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 2.2);
  }
}

/** The sound under the reel's intro (`dur` seconds), building into the music. */
export function scheduleIntroSound(ctx: BaseAudioContext, out: AudioNode, kind: IntroSound, start: number, dur: number) {
  if (kind === "none" || past(ctx, start + dur)) return;
  const end = start + dur;
  if (kind === "waves") return scheduleWaves(ctx, out, start, dur);
  if (kind === "takeoff") {
    // engines spooling up, then the rumble of the roll and lift-off
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(150, start);
    lp.frequency.exponentialRampToValueAtTime(900, end - 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.5, end - 0.8);
    g.gain.linearRampToValueAtTime(0.0001, end);
    noiseSrc(ctx, start, end).connect(lp).connect(g).connect(out);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(260, start);
    o.frequency.exponentialRampToValueAtTime(1100, end - 0.6);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 8;
    bp.frequency.setValueAtTime(260, start);
    bp.frequency.exponentialRampToValueAtTime(1100, end - 0.6);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, start);
    wg.gain.exponentialRampToValueAtTime(0.05, end - 0.8);
    wg.gain.linearRampToValueAtTime(0.0001, end);
    o.connect(bp).connect(wg).connect(out);
    if (!past(ctx, start)) {
      o.start(start);
      o.stop(end);
    }
    return;
  }
  if (kind === "chime") {
    // the airport "ding-dong-ding", then a soft pad and a riser into the beat
    [659.3, 523.3, 392].forEach((f, i) => bell(ctx, out, start + 0.4 + i * 0.55, f, 0.18));
    for (const semi of [36, 40, 43]) note(ctx, out, start + 2.4, hz(semi), dur - 2.6, "triangle", 0.03, 1500);
    riser(ctx, out, end - 2.4, end);
    return;
  }
  if (kind === "projector") {
    // a film projector's clatter and motor hum, under the old-film opening
    for (let t = start; t < end - 0.4; t += 1 / 12) hit(ctx, out, t, 3000, "bandpass", 0.025, 0.06 + 0.04 * Math.random());
    note(ctx, out, start, 110, dur - 0.3, "sine", 0.04, 400);
    riser(ctx, out, end - 2.2, end);
    return;
  }
  // vinyl: hiss and pops, a warm chord, a riser
  const hp = ctx.createBiquadFilter();
  hp.type = "bandpass";
  hp.frequency.value = 3500;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0.03, Math.max(start, ctx.currentTime));
  hg.gain.linearRampToValueAtTime(0.0001, end);
  noiseSrc(ctx, start, end).connect(hp).connect(hg).connect(out);
  for (let t = start; t < end - 0.3; t += 0.08 + Math.random() * 0.35) hit(ctx, out, t, 2500, "highpass", 0.01, 0.15 * Math.random());
  for (const semi of [24, 28, 31, 35]) note(ctx, out, start + 0.6, hz(semi), dur - 1.2, "sine", 0.03, 1200);
  riser(ctx, out, end - 2.2, end);
}

/** The game card's chest: a whoosh building from `from`, then a burst and a sparkly chime at `burst`. */
export function scheduleChest(ctx: BaseAudioContext, out: AudioNode, from: number, burst: number) {
  riser(ctx, out, from, burst);
  hit(ctx, out, burst, 3000, "lowpass", 0.5, 0.5);
  kick(ctx, out, burst, 0.8);
  [1318.5, 1568, 1975.5, 2637].forEach((f, i) => bell(ctx, out, burst + 0.05 + i * 0.07, f, 0.12));
}
