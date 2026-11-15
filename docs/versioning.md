# Versioning and updates

QuestPass Booth follows [semantic versioning](https://semver.org). If you load it with `@1`, you get every 1.x release the moment it's tagged, without changing anything on your site. What that promises:

**Within 1.x, never:**
- remove or rename an element, attribute, property, event, `detail` field or exported function;
- remove the credit line from frames or videos;
- remove a frame id, word slot id, track id or settings field, or change what a field means;
- make an optional setting required, or start sending data anywhere.

**Within 1.x, may:**
- add frames, tracks, settings, events and functions (new settings always have a default that keeps today's behaviour);
- change how frames look, the wording on buttons, and the layout;
- fix bugs and tighten checks on unsafe input.

**Settings files** carry `"version": 1`. A later config version will still read every older file (`migrateConfig`), so saved booths keep working.

**Breaking changes** go into a new major version (`@2`), with a migration note in the CHANGELOG. `@1` keeps working and keeps getting security fixes for at least 12 months after `@2` is out.

## Releasing (maintainers)

1. Update `version` in `package.json` and add a CHANGELOG entry.
2. `npm run check`. This rebuilds `dist/`, and `dist/` is committed so the CDN can serve it.
3. Commit, then `git tag v1.x.y && git push --follow-tags`.
4. jsDelivr picks up the tag. `@1` points to it within about 12 hours, or right away after a purge: `https://purge.jsdelivr.net/gh/simarpreetsingh-019/questpass-booth@1/dist/questpass-booth.js`.
