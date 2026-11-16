# Integration guide

## 1. Load it

From the CDN, getting every 1.x update automatically:

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/simarpreetsingh-019/questpass-booth@1/dist/questpass-booth.js"></script>
```

Other options:
- **Pin a version:** use `@1.0.0` for no automatic updates.
- **Self-host:** copy `dist/` to your server. The fonts must stay in `fonts/` next to `questpass-booth.js`, or call `setFontsBase()`.
- **From the repo with a bundler:** `npm install github:simarpreetsingh-019/questpass-booth`, then `import "questpass-booth"`.

Loading the script defines both elements. Load it once per page.

## 2. Give the booth its settings

There are three ways, and the first one found wins:

```html
<!-- a property (best from code) -->
<questpass-booth id="b"></questpass-booth>
<script type="module">document.getElementById("b").config = { title: "Global Pizza Party", brand: { name: "PizzaDAO" } };</script>

<!-- an attribute -->
<questpass-booth config='{"title":"Global Pizza Party"}'></questpass-booth>

<!-- a JSON file (fetched without cookies) -->
<questpass-booth config-src="/parties/123/booth.json"></questpass-booth>
```

Settings are always checked: anything missing gets its default, and anything unknown or unsafe is dropped. A config written for 1.0 works on every 1.x. See [config.md](config.md) for every field.

## 3. React (or any framework)

They're standard custom elements:

```jsx
import "questpass-booth";
import { useEffect, useRef } from "react";

export function PartyBooth({ party }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.config = party.boothConfig;
    const onPhoto = (e) => console.log("photo made", e.detail.frame);
    ref.current.addEventListener("questpass:photo", onPhoto);
    return () => ref.current?.removeEventListener("questpass:photo", onPhoto);
  }, [party]);
  return <questpass-booth ref={ref} />;
}
```

For TypeScript in JSX, declare `questpass-booth` and `questpass-booth-editor` in `JSX.IntrinsicElements`.

## 4. Events

Every event bubbles out of the element, so you can listen on the element or on `document`.

| Event | `detail` | When |
|---|---|---|
| `questpass:ready` | `{ version }` | The booth has loaded its settings. |
| `questpass:photo` | `{ blob, frame, ratio, name }` | A framed photo was made (on save or share). |
| `questpass:video` | `{ blob, type, frame, name }` | A video was made. |
| `questpass:share` | `{ kind: "photo" \| "video", method: "share" \| "download" }` | It was shared or saved. |
| `questpass:camera` | `{ on }` | The camera turned on or off. |
| `questpass:error` | `{ message }` | Something failed (the message is also shown to the person). |
| `change` (editor) | `{ config }` | The editor's settings changed. |

`blob` is the actual file. The booth never sends it anywhere. If your platform has a party gallery, uploading it is your choice and your code. Ask the person first, for example "Add to the party's photos?", rather than uploading on every save.

## 5. Your own screens

All the drawing is available as functions:

```js
import { listFrames, renderPhoto, makeVideo, drawPreview, normalizeConfig } from "questpass-booth";

const config = normalizeConfig(myJson);
const jpeg = await renderPhoto({ config, photos: [fileOrBitmap], frame: "polaroid", caption: "Slice of life", hd: true });
const { blob, type } = await makeVideo({ config, photos: files, frame: "booth", track: "happy", onProgress: (s, t) => {} });
```

- `listFrames()`: id, label, group, what each frame suits, its usual size, and how many photos it shows.
- `listTracks()`: the music.
- `framePalettes(frame)`: a frame's own colour sets.
- `createPreviewer(options)`: draws quickly and synchronously, for example a live camera inside the frame.
- `colorsFromImage(img)`: colours from a logo, or `null` if it's black and white.

Video clips:

```js
import { ClipSource, makeClipVideo, makeVideo } from "questpass-booth";

const clip = await ClipSource.open(file);          // a video File or Blob, read on the device
const framed = await makeClipVideo({ config, clip, frame: "festive-prints", start: 2, length: 10, sound: "both" });
const recap = await makeVideo({ config, frame: "polaroid", photos: [], order: [photo1, { clip, start: 0, length: 4 }, photo2] });
```

## 6. The brand lookup (optional, on your server)

The editor's "Fill in from website" button needs a small endpoint on your server, because browsers can't read other websites:

```js
// Next.js: app/api/brand/route.js
import { createBrandHandler } from "questpass-booth/server";
export const GET = createBrandHandler({ allowOrigins: ["https://your.site"], blocked: [] });
```

```js
// Express
import { nodeBrandHandler } from "questpass-booth/server";
app.get("/api/brand", nodeBrandHandler({ allowOrigins: ["https://your.site"] }));
```

Then `<questpass-booth-editor brand-endpoint="/api/brand">`. Without it, people upload the logo by hand.

The lookup reads only a site's public page and icons, and refuses private and internal addresses (see [SECURITY.md](../SECURITY.md)). Behind a proxy, pass `callerOf` so the rate limit counts each person, not your proxy.

## 7. Content Security Policy

The booth needs:
- `script-src` for wherever you load it from;
- `font-src` and `connect-src` for the same place (its fonts);
- `img-src data: blob:`;
- `media-src blob:`.

The camera needs `Permissions-Policy: camera=(self)`, and inside an iframe, `<iframe allow="camera">`. Styles live in the elements' own shadow roots, built without inline `style` attributes.
