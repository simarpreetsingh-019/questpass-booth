/**
 * Video clips, on the device: read a clip frame by frame, and make a framed
 * MP4 of it (the clip playing inside any frame, with its own sound, the
 * booth's music, or both). Nothing is uploaded.
 *
 * Where the browser can encode (WebCodecs), frames are made faster than
 * real time by seeking the clip; elsewhere the clip is played once and
 * recorded as it plays.
 */
import { TRACKS, scheduleTrack, type Track } from "../engine/upstream/music";
import { RATIOS, type Quality, type Ratio } from "../engine/upstream/reel";
import type { FrameId } from "../engine/upstream/frames";
import { createPreviewer, type FrameOptions, type PaletteChoice } from "./render";

/** The longest stretch of a clip used (seconds). */
export const CLIP_MAX_SEC = 30;
/** Clips longer than this aren't opened (seconds): phones run out of memory. */
export const CLIP_SOURCE_MAX_SEC = 10 * 60;

const FPS = 30;

/** A video clip that can be drawn at any moment of it (onto `canvas`). */
export class ClipSource {
  readonly video: HTMLVideoElement;
  readonly canvas = document.createElement("canvas");
  readonly url: string;
  readonly blob: Blob;
  duration = 0;
  private at = -1;

  private constructor(blob: Blob) {
    this.blob = blob;
    this.url = URL.createObjectURL(blob);
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.crossOrigin = "anonymous";
    this.video.src = this.url;
  }

  /** Open a clip (a File or Blob): its size and length are read, and its first frame drawn. */
  static async open(blob: Blob): Promise<ClipSource> {
    const c = new ClipSource(blob);
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("This video took too long to open.")), 15000);
      c.video.onloadeddata = () => (clearTimeout(t), res());
      c.video.onerror = () => (clearTimeout(t), rej(new Error("This phone can't open that video. Try another, or a photo.")));
    });
    c.duration = Number.isFinite(c.video.duration) ? c.video.duration : 0;
    if (!c.duration || !c.video.videoWidth) {
      c.close();
      throw new Error("That video couldn't be read. Try another, or a photo.");
    }
    if (c.duration > CLIP_SOURCE_MAX_SEC) {
      c.close();
      throw new Error("That video is too long. Pick one under 10 minutes, or trim it first.");
    }
    // a phone video is often 4K: draw it at most 1920 on its long side
    const k = Math.min(1, 1920 / Math.max(c.video.videoWidth, c.video.videoHeight));
    c.canvas.width = Math.round(c.video.videoWidth * k);
    c.canvas.height = Math.round(c.video.videoHeight * k);
    await c.frameAt(0);
    return c;
  }

  /** Draw the clip's frame at `t` seconds onto `canvas` (seeking there first). */
  async frameAt(t: number): Promise<HTMLCanvasElement> {
    const v = this.video;
    const target = Math.max(0, Math.min(this.duration - 0.01, t));
    if (Math.abs(target - this.at) > 0.001) {
      await new Promise<void>((res) => {
        const done = () => (clearTimeout(timer), v.removeEventListener("seeked", done), res());
        const timer = setTimeout(done, 1500);
        v.addEventListener("seeked", done);
        v.currentTime = target;
      });
      this.at = target;
    }
    this.draw();
    return this.canvas;
  }

  /** Draw whatever frame the video shows now (while it plays). */
  draw() {
    this.canvas.getContext("2d")?.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
  }

  close() {
    this.video.removeAttribute("src");
    this.video.load();
    URL.revokeObjectURL(this.url);
  }
}

export type ClipSound = "clip" | "music" | "both";

export interface ClipVideoOptions extends Omit<FrameOptions, "photos"> {
  clip: ClipSource;
  /** where to start in the clip, and how long (at most CLIP_MAX_SEC) */
  start?: number;
  length?: number;
  /** the clip's own sound, the booth's music, or both (music softer) */
  sound?: ClipSound;
  /** a track id (listTracks) for the music */
  track?: string;
  quality?: Quality;
  onProgress?: (seconds: number, total: number) => void;
  signal?: AbortSignal;
}

const bitrate = ([w, h]: [number, number], q: Quality) =>
  q === "high" ? Math.round(Math.min(14_000_000, Math.max(8_000_000, w * h * 6))) : Math.round(Math.min(6_000_000, Math.max(2_500_000, w * h * 2.4)));

/** The clip's sound (and the music) for the stretch used, rendered at once. */
async function soundFor(o: ClipVideoOptions, start: number, length: number, sampleRate: number): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.ceil(sampleRate * length), sampleRate);
  const sound = o.sound ?? "both";
  // everything goes through a limiter, so the clip and the music together never crackle
  const limiter = off.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  const out = off.createGain();
  out.gain.value = 0.9;
  limiter.connect(out).connect(off.destination);
  if (sound !== "music") {
    try {
      const decoded = await off.decodeAudioData(await o.clip.blob.arrayBuffer());
      const src = off.createBufferSource();
      src.buffer = decoded;
      const g = off.createGain();
      g.gain.value = sound === "both" ? 0.85 : 1;
      src.connect(g).connect(limiter);
      src.start(0, start, length);
    } catch {
      // a clip without sound (or one this browser can't read the sound of): music only
    }
  }
  if (sound !== "clip") {
    const track: Track = TRACKS.find((t) => t.id === o.track) ?? TRACKS[0]!;
    const g = off.createGain();
    g.gain.value = sound === "both" ? 0.35 : 1;
    g.connect(limiter);
    scheduleTrack(off, g, track, 0, length);
  }
  return off.startRendering();
}

async function videoConfig(w: number, h: number, rate: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42e028", "avc1.42001f"]) {
    const c: VideoEncoderConfig = { codec, width: w, height: h, bitrate: rate, framerate: FPS, avc: { format: "avc" } };
    try {
      if ((await VideoEncoder.isConfigSupported(c)).supported) return c;
    } catch {
      // try the next
    }
  }
  return null;
}

/**
 * The clip playing inside the frame, as a video file: an MP4 (H.264 + AAC)
 * made faster than real time where the browser can encode, else recorded as
 * it plays (MP4 or WebM, whatever the browser records).
 */
export async function makeClipVideo(o: ClipVideoOptions): Promise<{ blob: Blob; type: string }> {
  const start = Math.max(0, Math.min(o.start ?? 0, o.clip.duration - 0.5));
  const length = Math.max(0.5, Math.min(o.length ?? CLIP_MAX_SEC, CLIP_MAX_SEC, o.clip.duration - start));
  const p = await createPreviewer({ ...o, palette: (o.palette ?? "brand") as PaletteChoice });
  const [W] = RATIOS[p.ratio as Ratio];
  const canvas = document.createElement("canvas");
  p.draw(canvas, W, [await o.clip.frameAt(start)]);
  const size: [number, number] = [canvas.width, canvas.height];
  const quality = o.quality ?? "high";
  const fast = await encodeFast(o, p, canvas, size, start, length, quality);
  return fast ?? recordRealtime(o, p, canvas, size, start, length, quality);
}

type Previewer = Awaited<ReturnType<typeof createPreviewer>>;

async function encodeFast(o: ClipVideoOptions, p: Previewer, canvas: HTMLCanvasElement, size: [number, number], start: number, length: number, quality: Quality): Promise<{ blob: Blob; type: string } | null> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined" || typeof VideoFrame === "undefined" || typeof OfflineAudioContext === "undefined") return null;
  const [w, h] = size;
  const vcfg = await videoConfig(w, h, bitrate(size, quality));
  const sampleRate = 48000;
  const acfg: AudioEncoderConfig = { codec: "mp4a.40.2", sampleRate, numberOfChannels: 2, bitrate: quality === "high" ? 192_000 : 128_000 };
  let audioOk = false;
  try {
    audioOk = Boolean((await AudioEncoder.isConfigSupported(acfg)).supported);
  } catch {
    audioOk = false;
  }
  if (!vcfg || !audioOk) return null;
  const sound = await soundFor(o, start, length, sampleRate);
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: w, height: h, frameRate: FPS }, audio: { codec: "aac", sampleRate, numberOfChannels: 2 }, fastStart: "in-memory", firstTimestampBehavior: "offset" });
  let failed: unknown = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (failed = e) });
  venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (failed = e) });
  aenc.configure(acfg);
  let lock: WakeLockSentinel | null = null;
  try {
    lock = (await navigator.wakeLock?.request("screen")) ?? null;
  } catch {
    // no wake lock
  }
  try {
    const frames = Math.ceil(length * FPS);
    for (let i = 0; i < frames; i++) {
      if (o.signal?.aborted) throw new DOMException("cancelled", "AbortError");
      if (failed) throw failed;
      const t = i / FPS;
      p.draw(canvas, w, [await o.clip.frameAt(start + t)]);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) o.onProgress?.(t, length);
    }
    const left = sound.getChannelData(0);
    const right = sound.getChannelData(1);
    for (let at = 0; at < sound.length; at += 1024) {
      const n = Math.min(1024, sound.length - at);
      const data = new Float32Array(n * 2);
      data.set(left.subarray(at, at + n), 0);
      data.set(right.subarray(at, at + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((at * 1e6) / sampleRate), data });
      aenc.encode(ad);
      ad.close();
    }
    await Promise.all([venc.flush(), aenc.flush()]);
    if (failed) throw failed;
    muxer.finalize();
    o.onProgress?.(length, length);
    return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), type: "video/mp4" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return null;
  } finally {
    if (venc.state !== "closed") venc.close();
    if (aenc.state !== "closed") aenc.close();
    await lock?.release().catch(() => undefined);
  }
}

function recordType(): string {
  const types = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

/** The fallback: play the stretch once, drawing each frame into the frame, and record it with the sound. */
async function recordRealtime(o: ClipVideoOptions, p: Previewer, canvas: HTMLCanvasElement, size: [number, number], start: number, length: number, quality: Quality): Promise<{ blob: Blob; type: string }> {
  const type = recordType();
  if (!type) throw new Error("This browser can't make videos. Try Chrome or Safari.");
  const audio = new AudioContext();
  await Promise.race([audio.resume(), new Promise((r) => setTimeout(r, 1500))]);
  const dest = audio.createMediaStreamDestination();
  // the sound, rendered first, then played into the recording
  const buffer = await soundFor(o, start, length, audio.sampleRate);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate(size, quality) });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  const v = o.clip.video;
  v.currentTime = start;
  await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
  // the clip first: recording starts once it's really playing, so picture and sound line up
  await v.play();
  await new Promise<void>((r) => (v.readyState >= 3 && !v.paused ? r() : v.addEventListener("playing", () => r(), { once: true })));
  const v0 = v.currentTime;
  rec.start(500);
  const t0 = audio.currentTime;
  src.start(t0);
  try {
    await new Promise<void>((res, rej) => {
      const tick = () => {
        if (o.signal?.aborted) return rej(new DOMException("cancelled", "AbortError"));
        // the clip's own clock decides when the stretch is over
        const t = Math.max(0, v.currentTime - v0, audio.currentTime - t0 - 0.25);
        o.clip.draw();
        p.draw(canvas, size[0], [o.clip.canvas]);
        o.onProgress?.(Math.min(t, length), length);
        if (t >= length) return res();
        requestAnimationFrame(tick);
      };
      tick();
    });
  } finally {
    v.pause();
    rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    await audio.close().catch(() => undefined);
  }
  return { blob: new Blob(chunks, { type: type.split(";")[0] }), type: type.split(";")[0]! };
}

export type { FrameId };
