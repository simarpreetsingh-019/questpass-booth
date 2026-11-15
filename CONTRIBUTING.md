# Contributing

Issues and pull requests are welcome.

- `npm install`, then `npm run check` (types, tests and a build) before you open a pull request.
- Test on a phone-sized screen first: most people use the booth on a phone.
- Keep the promises in [docs/versioning.md](docs/versioning.md) and [PRIVACY.md](PRIVACY.md): no breaking changes within a major version, and no data leaving the device.
- `src/engine/upstream` is copied from QuestPass. Change it there, or add a patch in `patches/`.
- Commit the rebuilt `dist/` with code changes: the CDN serves it from the repository.
