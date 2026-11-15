# Connecting your own services: Discord, NFTs, your own frames

The booth runs on the device and knows nothing about anyone's accounts. Your site does, so your site passes in what it knows, and the booth hands back what it makes. These are the open interfaces for that.

## The member's name and picture (e.g. from a Discord login)

If your site knows who's using it (a Discord login, a member database), fill in their mafia name, their line, and a picture such as their profile NFT:

```js
const booth = document.querySelector("questpass-booth");
booth.person = {
  name: member.mafiaName,   // "Chorizo Corleone": shown in full under the photo
  line: member.tagline,     // the line under the name
  avatar: member.nftImage,  // an image URL that allows CORS, a Blob or an ImageBitmap
};
```

Without JavaScript you can use `<questpass-booth person-name="Chorizo Corleone" person-line="Extra cheese" person-handle="chorizo">`. You can also pass `handle` and `network` ("telegram", "x", "instagram") to `booth.person`.

They can still edit the name and line in the booth. The picture appears on frames that show one (the badge, the game card, the story) and on the video's cards.

For the picture:
- **Fetch it from your own server, not the browser.** Get the NFT image server-side (from the metadata's `image` field; for `ipfs://` use your gateway) and serve it from your domain, or pass a Blob. Many NFT hosts don't allow CORS, and that keeps your API keys off the page.
- **Discord is the same:** the avatar URL (`cdn.discordapp.com/avatars/…`) comes from your login flow.

## Usernames and profile pictures

With `person.handle.ask` on, people type their username (Telegram, X or Instagram; pasted links like `https://t.me/name` are tidied to `@name`). It's shown as a tag on every frame: their picture, the network's mark and @username, in the corner of the photo.

Their picture can come from:
- **An upload:** a profile picture, an NFT or a selfie (`person.picture`).
- **Your site:** `booth.person = { avatar }`, for example the NFT from their connected wallet.
- **Their public profile**, through the picture lookup on your server:

```js
// Next.js: app/api/avatar/route.js
import { createAvatarHandler } from "questpass-booth/server";
export const GET = createAvatarHandler({ allowOrigins: ["https://your.site"], x: true });
```

Then `<questpass-booth avatar-endpoint="/api/avatar">` shows "Use my Telegram picture" (or X).

| Network | How | Notes |
|---|---|---|
| Telegram | the public profile page (`t.me/name`) | Public profiles with a photo. No keys needed. |
| X | the open fxtwitter.com service | Off unless `x: true`. X has no free official way, so this is unofficial and could stop working. |
| Instagram | not supported | Instagram blocks automated requests and its terms forbid them, so people upload a picture instead. |

The lookup runs only when the person taps the button. It sends only the username to Telegram or fxtwitter, from your server, and keeps nothing.

## Sending photos somewhere (a Discord channel, a party gallery)

The booth never uploads anything. When a photo or video is made, it gives your page the file:

```js
booth.addEventListener("questpass:photo", async (e) => {
  const { blob, frame, name } = e.detail;
  if (!confirm("Also post it to the party's Discord?")) return;      // ask first
  const form = new FormData();
  form.append("file", blob, name);
  await fetch("/api/party/123/photos", { method: "POST", body: form }); // your server
});
```

Your server posts it on: a Discord webhook (`POST https://discord.com/api/webhooks/…` with the file), your gallery, your storage.

**Never put a Discord webhook URL or bot token in the page.** Anyone can read the page's code and post as your bot. Keep them on the server.

The same goes for `questpass:video`. `questpass:share` and `questpass:camera` are there for your own counters, if you keep any.

## Your own frames (an NFT frame, a sponsor's frame)

A frame is one object with a few drawing functions. The [pizza pack](../src/packs/pizza.ts) has five complete examples. To add one:

```js
import { registerFrame, registerWordSlot } from "questpass-booth";

registerFrame("rare-pizza", {
  label: "🍕 Rare Pizza",
  group: "Pizza",
  palettes: () => [{ name: "Gold", bg: "#111", fg: "#FFD23D", muted: "#999", paper: "#fff", ink: "#111", accent: "#FFD23D", accent2: "#FF393A" }],
  // where the photo goes, for any size (W×H; u = 1 on a 1080 grid)
  window: (W, H, u) => ({ x: 100 * u, y: 200 * u, w: W - 200 * u, h: H - 500 * u }),
  ownsText: true,
  back(ctx, f) { /* draw behind the photo: f.pal colours, f.eventName, f.journey.name, f.journey.avatar … */ },
  front(ctx, f) { /* draw over it: the name f.journey.name, the line f.text, f.words["rare-pizza.badge"] … */ },
}, { best: "Holders of a Rare Pizza", ratio: "9:16", pack: "nft" });

registerWordSlot({ id: "rare-pizza.badge", frame: "rare-pizza", label: "Badge", max: 20, placeholder: "HOLDER", defaultMode: "fixed" });
```

Then put `"packs": ["nft"]` in the booth's settings, or name the frame in `frames.allow`. Register it before you give the booth its settings.

The frame gets everything through `f`:
- **The booth:** title, place, dates, the brand's logo (`f.sponsor`), the frame's colours (`f.pal`).
- **The person:** name, line and picture.
- **The photos:** `f.photos`.
- **For videos:** where it is in the video (`f.t`, `f.seg`).

New text spaces show up in the editor automatically, so organisers can change their words.

## Settings from your own systems

The booth's settings are plain JSON (see [config.md](config.md)), so anything that can write JSON can run booths:
- **Your database:** an admin page saves the editor's `change` event as JSON; the booth reads it with `config-src`.
- **A spreadsheet:** see [spreadsheet.md](spreadsheet.md).
- **Your server:** `import { normalizeConfig } from "questpass-booth/config"` checks settings in Node before you save them.

## Brand from a website

`questpass-booth/server` fills in a brand's name, logo and colours from its website, the editor's "Fill in from website" button. Run it on your own server; see the [integration guide](integration.md#6-the-brand-lookup-optional-on-your-server).
