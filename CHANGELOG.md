# Changelog

## 1.0.0 (2026-11-15)

First release.
- `<questpass-booth>`: camera or photo picker, 23 frames in 4 sizes, brand and frame colours, the frames' text spaces, HD save and share, and a video maker (MP4 with music made on the device).
- `<questpass-booth-editor>`: set up a booth with a live preview, fill in a brand from its website, and export the settings as JSON.
- Functions: `renderPhoto`, `makeVideo`, `drawPreview`, `createPreviewer`, `listFrames`, `listTracks`, `normalizeConfig` and more.
- `questpass-booth/server`: a brand lookup with protection against server-side request forgery.
- Engine from QuestPass 55a6a35.
