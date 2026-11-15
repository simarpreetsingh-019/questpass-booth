# Booths from a spreadsheet

Keep every booth in one Google Sheet (or Excel, saved as CSV): one row per city or party. Each row becomes a booth page with its own link. You also get an index page with every link and a QR code to print for each venue. Edit the sheet and the booths update within the hour, or straight away with "Run workflow".

## 1. The booths sheet

The first row holds the column names. Only `slug` (or `place`) is required; every other column is optional and falls back to the base settings (e.g. `presets/pizzadao.json`).

| Column | Example | What it sets |
|---|---|---|
| `slug` | `mumbai` | The booth's address: `…/booths/mumbai/`. Lowercase letters, digits and dashes. Made from `place` if empty. |
| `title` | Global Pizza Party | The title on the frames. |
| `place` | Mumbai | Where. |
| `dates` | 22 May 2027 | The date line. |
| `link` | https://… | Where "make yours" and the QR on the video point (default: the booth's own page). |
| `share_text` | Pizza the Planet {link} | The words shared with a photo. |
| `accent`, `highlight`, `base`, `text` | `#FF393A` | Colours. |
| `brand`, `website`, `logo` | PizzaDAO, https://pizzadao.org, https://…/logo.png | The brand. `logo` must be an https PNG/JPEG/WebP/GIF that allows other sites to load it. |
| `default_frame` | `pizza-box` | The frame it opens with (ids: `listFrames()`, or the [frame gallery](../demo/gallery.html)). |
| `frames` | `pizza-box, neon, polaroid` | Only these frames (default: all). |
| `first_frames` | `pizza-mafia, pizza-box` | These first in the picker. |
| `packs` | `pizza` | Frame packs to include. |
| `name_label`, `line_label` | Your mafia name, Your line | The two fields' labels. |
| `video` | yes / no | The video maker. |
| `words.<space>` | `words.neon.sign` = PIZZA TIME | A frame's text. Just words: always these words. `edit: words`: people can change them. `off`: left off. |

Ids for the text spaces are listed in the editor and by `listWordSlots()`, for example `neon.sign`, `pizza-mafia.crime`, `pizza-receipt.item1`, `pizza-table.special`.

A ready example is in [`examples/booths.csv`](../examples/booths.csv).

## 2. The names sheet (optional)

Names people can pick as they type, for example the members' mafia names:

| `name` | `booth` |
|---|---|
| Chorizo Corleone | |
| Mozz DeNiro | mumbai |
| Basil Bambino | mumbai, lagos |

An empty `booth` puts the name in every booth. Only list names people agreed to have shown: anyone who opens a booth can see its list. See [`examples/names.csv`](../examples/names.csv).

## 3. Publish the sheets as CSV

In Google Sheets, open File → Share → Publish to web, pick the tab, choose "Comma-separated values (.csv)" and Publish. Copy the link (it ends in `output=csv`). Do this for both sheets. Published sheets can be read by anyone with the link, so keep private notes in another file.

## 4. Turn it on

The repository's `pages` workflow builds the booths and hosts them on GitHub Pages:

1. Fork this repository (or use it as a template).
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables**:
   - `SHEET_URL`: the booths sheet's CSV link (required);
   - `NAMES_URL`: the names sheet's link (optional);
   - `BOOTH_BASE`: another base settings file in the repo (optional; default `presets/pizzadao.json`).
4. Actions → pages → **Run workflow**.

The booths are at `https://<owner>.github.io/<repo>/booths/<slug>/`, and the printable list with QR codes at `…/booths/`. The workflow runs again every hour, so sheet edits go live without anyone touching the code.

## Running it by hand

```bash
npm install && npm run build
node scripts/booths-from-sheet.mjs --sheet booths.csv --names names.csv \
  --base presets/pizzadao.json --base-url https://your.site/booths --out site/booths
```

Upload `site/booths` to any static host. The script reports anything in the sheet it couldn't use (a colour that isn't `#RRGGBB`, text too long for its space, an http link) and what it used instead.
