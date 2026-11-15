# Settings reference (config version 1)

A booth is one JSON object. Every field is optional. `normalizeConfig()` fills in defaults, caps lengths and drops anything unsafe or unknown. The editor makes this for you.

```json
{
  "version": 1,
  "title": "Global Pizza Party",
  "place": "Mumbai",
  "dates": "Sat 22 May 2027",
  "brand": {
    "name": "PizzaDAO",
    "website": "https://pizzadao.org",
    "logo": "data:image/png;base64,…",
    "colors": { "accent": "#FF5A36", "highlight": "#FFC440", "base": "#140A06", "text": "#FFF4E8" }
  },
  "showBrand": true,
  "credit": true,
  "frames": { "allow": "all", "default": "polaroid" },
  "words": { "neon.sign": { "mode": "fixed", "text": "PIZZA TIME" } },
  "video": { "enabled": true, "qr": true, "showBrand": true },
  "share": { "text": "Made at the pizza party {link}", "link": "https://your.site/party/123" },
  "camera": { "idleSeconds": 30, "timer": true },
  "maxPhotos": 9
}
```

| Field | Default | Notes |
|---|---|---|
| `title` | "Photo booth" | Up to 40 characters. Shown on the frames and the video's first card. |
| `place`, `dates` | "" | Up to 30 and 40 characters. Empty leaves them off. |
| `brand.name` | "" | Shown where there's no logo. |
| `brand.website` | "" | http(s). Printed on frames that show an address. |
| `brand.logo` | "" | A PNG, JPEG, WebP or GIF data URL (up to about 1.5 MB), or an https URL that allows CORS. No SVG, because SVG files can carry scripts. |
| `brand.colors` | green on black | Four `#RRGGBB` colours. |
| `brand.headingFont` | "default" | `"condensed"` for a bold condensed title and buttons (Asap Condensed). |
| `showBrand` | true | The logo on the frames and the video's opening card. |
| `credit` | true | "made with QuestPass". Please keep it on. |
| `frames.allow` | "all" | `"all"` or a list of frame ids (see `listFrames()`). |
| `frames.default` | "polaroid" | Must be one of the allowed frames. |
| `frames.first` | [] | Frames shown first in the picker, in this order. |
| `packs` | [] | Frame packs to include, e.g. `["pizza"]` for the five pizza frames. |
| `person.wholeName` | true | Show the whole name ("Chorizo Corleone"), not just the first word. |
| `person.nameLabel`, `person.lineLabel` | "Your name", "Caption" | The two fields' labels ("Your mafia name", "Your line"). The line is printed under the photo. |
| `person.names` | [] | Names offered as people type (up to 5,000), e.g. members' mafia names. Anyone who opens the booth can see them. |
| `person.suggest` | empty | `{ "first": [...], "last": [...] }`: a 🎲 button makes a name from one word of each. |
| `words` | {} | Per text space: `mode` is `fixed` (your words), `edit` (people type their own, starting from your text) or `off`. Ids come from `listWordSlots()`. |
| `video.enabled` | true | Show the video maker. |
| `video.qr` | true | A QR code and link on the last card (needs `share.link`). |
| `video.showBrand` | true | The logo on the last card. |
| `share.text` | "Made at the photo booth {link}" | Up to 280 characters. `{link}` is replaced by `share.link`. |
| `share.link` | "" | https only. Your booth's page. |
| `camera.idleSeconds` | 30 | 10–120. The camera turns off this long after it's opened, whatever is happening. |
| `camera.timer` | true | A 3-second countdown. |
| `maxPhotos` | 9 | 1–20. Photos kept at once (in memory only). |
