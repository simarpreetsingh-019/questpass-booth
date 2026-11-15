/**
 * A public profile picture from a username, on your server (browsers can't
 * read these sites). Only when the person asks ("Use my Telegram picture"),
 * and nothing is kept.
 *
 *  - Telegram: the public profile page (t.me/<username>) shows the photo
 *    to anyone; works for public profiles with a photo.
 *  - X: X has no free official way. This uses the open fxtwitter.com
 *    service, which is unofficial and could stop working, so it is off unless
 *    you set `x: true`.
 *  - Instagram: not supported (it blocks automated requests and its terms
 *    forbid them); people upload a picture instead.
 */
import { BlockedAddressError, safeGet, type GetOptions } from "./net";
import { sniffImage, tags } from "./brand";

export type AvatarNetwork = "telegram" | "x";

export interface AvatarOptions {
  /** look up X pictures through fxtwitter.com (unofficial; default off) */
  x?: boolean;
  timeoutMs?: number;
  userAgent?: string;
}

export class AvatarNotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "AvatarNotFoundError";
  }
}

const USERNAME = /^[A-Za-z0-9_]{1,32}$/;
// the hosts the pictures may come from (nothing else is fetched)
const TELEGRAM_IMAGES = /(^|\.)(telesco\.pe|telegram\.org|cdn-telegram\.org)$/;
const X_IMAGES = /^pbs\.twimg\.com$/;

async function image(url: string, hosts: RegExp, o: GetOptions): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !hosts.test(u.hostname)) throw new AvatarNotFoundError("unexpected picture host");
  const max = 1024 * 1024;
  const r = await safeGet(u, { ...o, maxBytes: max, accept: "image/jpeg,image/png,image/webp" });
  const type = r.status < 400 && r.body.length < max ? sniffImage(r.body) : null;
  if (!type) throw new AvatarNotFoundError("no picture");
  return `data:${type};base64,${r.body.toString("base64")}`;
}

/** The profile picture as a data URL. */
export async function fetchAvatar(network: string, username: string, opts: AvatarOptions = {}): Promise<string> {
  const o: GetOptions = { maxBytes: 256 * 1024, timeoutMs: opts.timeoutMs ?? 6000, accept: "text/html", userAgent: opts.userAgent ?? "Mozilla/5.0 (compatible; QuestPassBooth/1; profile picture)" };
  const name = username.replace(/^@/, "");
  if (!USERNAME.test(name)) throw new AvatarNotFoundError("That isn't a username.");
  if (network === "telegram") {
    // t.me and telegram.me serve the same page (t.me is blocked on some networks)
    for (const host of ["t.me", "telegram.me"]) {
      try {
        const page = await safeGet(`https://${host}/${name}`, o);
        const og = tags(page.body.toString("utf8"), "meta").find((m) => (m.property ?? "").toLowerCase() === "og:image")?.content ?? "";
        // no photo (or no such user): the page shows Telegram's own logo
        if (!og || /telegram\.org\/img\/t_logo/.test(og)) throw new AvatarNotFoundError("No public Telegram profile picture for that username.");
        return await image(og, TELEGRAM_IMAGES, o);
      } catch (e) {
        if (e instanceof AvatarNotFoundError || e instanceof BlockedAddressError) throw e;
        // that host didn't answer: try the other
      }
    }
    throw new AvatarNotFoundError("Telegram didn't answer.");
  }
  if (network === "x") {
    if (!opts.x) throw new AvatarNotFoundError("X pictures aren't switched on here. Upload one instead.");
    const r = await safeGet(`https://api.fxtwitter.com/${name}`, { ...o, accept: "application/json" });
    let url = "";
    try {
      url = String((JSON.parse(r.body.toString("utf8")) as { user?: { avatar_url?: unknown } }).user?.avatar_url ?? "");
    } catch {
      url = "";
    }
    if (!url) throw new AvatarNotFoundError("No X profile picture for that username.");
    return image(url.replace(/_normal(\.\w+)$/, "_400x400$1"), X_IMAGES, o);
  }
  throw new AvatarNotFoundError("Pictures can be looked up for Telegram and X. Upload one instead.");
}
