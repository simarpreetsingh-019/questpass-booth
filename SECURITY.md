# Security

## Reporting a problem

Please report security issues privately, via GitHub's "Report a vulnerability" on this repository (Security tab), rather than in a public issue. You'll get a reply within a few days. Fixes go out as a patch release to every supported major version.

## How it's built

**In the browser**
- **No HTML from data.** All text, including settings, captions and brand names, is set as text, never as HTML. The UI lives in shadow roots.
- **Settings are checked** (`normalizeConfig`):
  - lengths are capped and control and direction-override characters removed;
  - colours must be `#RRGGBB`;
  - links must be http(s) with no credentials, and the booth link https only;
  - logos must be PNG, JPEG, WebP or GIF (never SVG) under a size limit;
  - unknown fields are dropped.
- **Logos picked in the editor** are redrawn as PNG on the device, which drops hidden data.
- **Logos given as a URL** are fetched with CORS and no cookies or referrer. If they can't be, they're left off.
- **CSP-friendly:** no `eval`, no inline styles or scripts, and one self-contained module plus its fonts.

**On the server (the optional brand lookup)**
- **Only public websites are reached** (protection against server-side request forgery):
  - http and https only, ports 80 and 443 only, no `user:password@`;
  - `localhost`, `.local` and `.internal` names refused;
  - every address checked at the moment of connecting, so a name that points at a private, loopback, link-local or cloud-metadata address is refused, even if it changes between lookups;
  - at most 3 redirects, each checked the same way.
- **Limits:** 6-second timeout, the first 512 KB of a page, 100 KB manifests, 1 MB logos, no cookies sent.
- **The picture lookup** takes only a username (letters, digits, `_`), fetches only Telegram's or fxtwitter's pages, and accepts pictures only from their image hosts (`telesco.pe`, `pbs.twimg.com`), through the same safe fetching.
- **Pictures are identified by their bytes**, never by the server's word. Only PNG, JPEG, WebP and GIF pass; a PNG inside an `.ico` is extracted.
- **Abuse limits:** 30 lookups per caller per hour by default, cross-origin browser calls only from `allowOrigins`, and a `blocked` list for brands that opt out.

## Supply chain
- **Few runtime dependencies:** `qrcode` and `mp4-muxer`, bundled into `dist/` at build time.
- **No install scripts** run for users.
- **CDN loading:** with `@1` you trust this repository's releases. For no automatic code changes, pin an exact version with Subresource Integrity, or self-host `dist/`.
