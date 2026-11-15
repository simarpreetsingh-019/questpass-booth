# QuestPass Booth

A branded photo booth and video maker for any event, that runs on the phone.

- **23 photo frames**: polaroid, photo strip, newspaper, neon sign, boarding pass, magazine cover and more, in Story, Post, Square and Wide sizes.
- **Videos with music**: the photos cut to the beat, as an MP4 ready for Instagram, X and WhatsApp. The music is generated on the phone, so there's nothing to license.
- **Your brand on everything**: logo, colours, title, place and date, and your own words in each frame's text spaces.
- **Set up in a minute**: type a website and the editor fills in the brand's name, logo and colours. Check them, adjust, done.
- **Pizza pack**: five frames for pizza parties (a pizza box, a Bitcoin Pizza Day receipt, a Pizza Mafia wanted poster, a whole pizza, a pizzeria table) and a ready Pizza DAO theme, with mafia names.
- **Private by design**: photos and videos are made on the device and never uploaded. No accounts, no tracking, no third-party requests.

Made by [Simarpreet Singh](https://x.com/simarpreet_019) for [QuestPass](https://questpass.live), the Devcon 8 travel board, and opened up for every event.

## Add it to a page

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/simarpreetsingh-019/questpass-booth@1/dist/questpass-booth.js"></script>

<questpass-booth config-src="/my-booth.json"></questpass-booth>
```

That's the whole booth. `@1` means you get every 1.x update automatically, and never a breaking one (see [versioning](docs/versioning.md)). To control updates yourself, pin an exact version (`@1.0.0`) or copy `dist/` to your own server.

Make the settings file with the editor:

```html
<questpass-booth-editor brand-endpoint="/api/brand"></questpass-booth-editor>
<script type="module">
  document.querySelector("questpass-booth-editor").addEventListener("change", (e) => {
    saveSomewhere(e.detail.config); // your own storage: the editor never saves anything itself
  });
</script>
```

Or try both in the demo: `npm install && npm run build && npm run demo`, then open http://localhost:8787 (every frame: http://localhost:8787/gallery.html; the developer event log: add `?debug`).

## What's in here

| | |
|---|---|
| `<questpass-booth>` | The booth: camera or photo picker, frames, colours, words, save or share, and the video maker. |
| `<questpass-booth-editor>` | Set up a booth with a live preview; gives you the settings as JSON. |
| JavaScript functions | `renderPhoto`, `makeVideo`, `drawPreview`, `listFrames`… to build your own screens. |
| `questpass-booth/server` | Optional brand lookup for your server, behind "Fill in from website". |

- [Integration guide](docs/integration.md): React, plain HTML, events, your own UI, the server.
- [Settings reference](docs/config.md): every field of the booth's JSON.
- [Booths from a spreadsheet](docs/spreadsheet.md): one row per city, published and updated automatically.
- [Connecting your services](docs/integrations.md): Discord, NFTs, posting photos, your own frames.
- [Versioning and updates](docs/versioning.md): what "no breaking changes" means here.
- [Privacy](PRIVACY.md) and [Security](SECURITY.md).

## Working on it

```bash
npm install
npm run check        # types, tests and a build
npm run demo         # http://localhost:8787
```

The frames and video engine come from QuestPass (`src/engine/upstream`, unchanged apart from `patches/`). To bring in QuestPass's latest: `sh scripts/sync-engine.sh ../mumbai-passport`, then `npm run check`.

## Licence and credit

Apache-2.0. You can use, change and ship it, including commercially. Keep the `LICENSE` and `NOTICE` files with any copy.

The booth shows a small "made with QuestPass" line by default. You can turn it off (`credit: false`), but leaving it on is how this stays free and maintained.
