/**
 * A person's username (Telegram, X, Instagram) and the tag that shows it on
 * every frame: their picture, the network's mark and @username, in the
 * photo's bottom-left corner.
 */
import { F, text } from "../engine/upstream/draw-kit";
import type { FrameCtx } from "../engine/upstream/frames";
import { roundRect } from "../engine/upstream/reel";
import { CREDIT_LINE } from "./credit";

export type Network = "telegram" | "x" | "instagram";

export const NETWORKS: Record<Network, { label: string; color: string; mark: string; url: (u: string) => string }> = {
  telegram: { label: "Telegram", color: "#2AABEE", mark: "✈", url: (u) => `https://t.me/${u}` },
  x: { label: "X", color: "#000000", mark: "𝕏", url: (u) => `https://x.com/${u}` },
  instagram: { label: "Instagram", color: "#E1306C", mark: "◎", url: (u) => `https://instagram.com/${u}` },
};

export const isNetwork = (v: unknown): v is Network => typeof v === "string" && v in NETWORKS;

/**
 * A username from whatever was typed or pasted: "@name", "t.me/name",
 * "https://x.com/name?s=20" → "name". Letters, digits, _ and . only, up to 32.
 */
export function cleanHandle(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input.trim();
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|x\.com|twitter\.com|instagram\.com)\/(?:s\/)?@?([^/?#\s]+)/i.exec(s);
  if (fromUrl) s = fromUrl[1]!;
  s = s.replace(/^@+/, "");
  return /^[A-Za-z0-9_.]{1,32}$/.test(s) ? s : s.replace(/[^A-Za-z0-9_.]/g, "").slice(0, 32);
}

/** The tag over the photo (drawn on every frame, after the frame itself). Nothing without a handle or a picture. */
export function drawTag(ctx: CanvasRenderingContext2D, f: FrameCtx) {
  const j = f.journey;
  if (j.addCredit) text(ctx, CREDIT_LINE, f.W / 2, f.H - 20 * f.u, F.mono(17 * f.u, 600), "rgba(255,255,255,0.75)");
  const handle = j.handle ?? "";
  const pic = j.avatar.kind === "image" ? j.avatar.image : null;
  if (!handle && !pic) return;
  const { R } = f;
  const m = Math.min(R.w, R.h);
  const h = Math.max(30, m * 0.085);
  const pad = Math.max(10, m * 0.03);
  const net = isNetwork(j.network) ? NETWORKS[j.network] : null;
  ctx.save();
  const font = F.sans(h * 0.46, 800);
  ctx.font = font;
  const tw = handle ? ctx.measureText(handle).width : 0;
  const markW = handle && net ? h * 0.62 : 0;
  const w = Math.min(R.w - pad * 2, (pic ? h : h * 0.3) + markW + (handle ? tw + h * 0.55 : 0));
  const x = R.x + pad;
  const y = R.y + R.h - pad - h;
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  roundRect(ctx, { x, y, w, h }, h / 2);
  ctx.fill();
  let cx = x + h * 0.1;
  if (pic) {
    const d = h * 0.8;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + d / 2, y + h / 2, d / 2, 0, Math.PI * 2);
    ctx.clip();
    const k = Math.max(d / pic.width, d / pic.height);
    ctx.drawImage(pic, cx + d / 2 - (pic.width * k) / 2, y + h / 2 - (pic.height * k) / 2, pic.width * k, pic.height * k);
    ctx.restore();
    cx += h * 0.9;
  } else cx += h * 0.2;
  if (handle && net) {
    const r = h * 0.24;
    ctx.fillStyle = net.color;
    ctx.beginPath();
    ctx.arc(cx + r, y + h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, net.mark, cx + r, y + h / 2 + 1, F.sans(r * 1.15, 800), "#FFFFFF");
    cx += markW;
  }
  if (handle) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w - h * 0.3, h);
    ctx.clip();
    text(ctx, handle, cx, y + h / 2 + 1, font, "#FFFFFF", "left");
    ctx.restore();
  }
  ctx.restore();
}
