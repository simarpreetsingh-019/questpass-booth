#!/bin/sh
# Copies the frame and video engine from a QuestPass checkout into
# src/engine/upstream, unchanged, then applies patches/*.patch (the few
# changes the booth needs, e.g. fonts from this package instead of Google).
# Usage: sh scripts/sync-engine.sh ../mumbai-passport
set -eu
SRC="${1:-../mumbai-passport}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/engine/upstream"
for f in \
  src/features/reel/engine/frames.ts \
  src/features/reel/engine/frames-prints.ts \
  src/features/reel/engine/reel.ts \
  src/features/reel/engine/music.ts \
  src/features/recap/engine/draw-kit.ts \
  src/config/frame-words.ts
do
  [ -f "$SRC/$f" ] || { echo "missing $SRC/$f" >&2; exit 1; }
  cp "$SRC/$f" "$DEST/$(basename "$f")"
done
( cd "$SRC" && git rev-parse --short HEAD ) > "$DEST/UPSTREAM_COMMIT" 2>/dev/null || echo unknown > "$DEST/UPSTREAM_COMMIT"
for p in "$(dirname "$0")"/../patches/*.patch; do
  [ -f "$p" ] || continue
  ( cd "$(dirname "$0")/.." && patch -s -p1 < "$p" ) || { echo "patch failed: $p (update it for the new upstream)" >&2; exit 1; }
done
echo "engine synced from $SRC @ $(cat "$DEST/UPSTREAM_COMMIT")"
