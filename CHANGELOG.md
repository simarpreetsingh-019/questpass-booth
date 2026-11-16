# Changelog

## 1.1.0 (2026-11-16)

- New frame for every booth, in a new **Festive** group: **Festive prints**. Two photo prints on warm paper, gold hanging diyas and a mandala, with the title, name and line written underneath. Three colour sets: cream & gold, maroon night, ivory & marigold. For Diwali, Lohri, Gurpurab, weddings and community evenings.
- Hidden controls stay hidden (the video maker's Cancel button showed before a video was being made).

## 1.0.0 (2026-11-15)

First release.
- `<questpass-booth>`: camera or photo picker, 23 frames in 4 sizes, brand and frame colours, the frames' text spaces, HD save and share, and a video maker (MP4 with music made on the device).
- `<questpass-booth-editor>`: set up a booth with a live preview, fill in a brand from its website, and export the settings as JSON.
- Functions: `renderPhoto`, `makeVideo`, `drawPreview`, `createPreviewer`, `listFrames`, `listTracks`, `normalizeConfig` and more.
- `questpass-booth/server`: a brand lookup with protection against server-side request forgery.
- Pizza pack: six pizza-party frames (including a Rare Pizza NFT card: the name as the pizza's name and number, a rarity and traits that stay the same for that name) with their own text spaces (`packs: ["pizza"]`).
- Usernames (Telegram, X, Instagram) and pictures (upload, NFT from the host site, or the public Telegram/X picture via `createAvatarHandler`), shown as a tag on every frame.
- Whole names (mafia names) and a line under the photo; a 🎲 name maker and a list of names to pick from (`person`).
- `registerFrame` and `registerWordSlot` for your own frames; `booth.person` (name, line, picture) for sites that know who's using it.
- `scripts/booths-from-sheet.mjs` and the `pages` workflow: one booth per spreadsheet row, hosted on GitHub Pages and rebuilt hourly.
- `questpass-booth/config`: the settings functions for Node.
- The credit "QuestPass · @simarpreet_019" is on every frame and video, with no setting.
- A public booth page and a separate organisers' setup page (`npm run setup`); with a sheet, the published site has only the booths.
- docs/pizzadao.md: the guide for Pizza DAO organisers.
- A ready-made Pizza DAO theme (`presets/pizzadao.json`), and `brand.headingFont: "condensed"`.
- Engine from QuestPass 5339307.
