#!/usr/bin/env bash
# Copy the two frames the site uses STRAIGHT off the shoot, and give them the
# filenames the pages actually reference.
#
# Everything else in public/img is written by pipeline/retouch.py, which crops,
# retouches and exports each frame under its own output name — the key in
# retouch.json. This script used to list those frames too, which meant a run of
# it would quietly overwrite fifteen retouched exports with their raw originals,
# price tags and all. It now covers only what retouch.json does not own.
#
# The rename on the way in is the point: the camera called them IMG_6070 and
# IMG_6077, which tells a person nothing and tells Google Images less.
set -euo pipefail

SRC="${1:-/home/claude/gss/assets}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/img"
mkdir -p "$DEST"

# frame:published-name
FRAMES=(
  IMG_6070:glen-smoke-shop-storefront   # the storefront at night — the visit and gallery share card
  IMG_6077:hand-blown-water-pipe-case   # the lit glass case — the home hero backdrop and the glass share card
)

# AVIF and JPEG at 960 and 1600. Nothing larger ships: no section image renders
# wider than ~52vw, so 1600 already covers a 2x display. The hero sign has its
# own art-directed plates, built by pipeline/sign_hero.py.
copied=0 missing=()
for pair in "${FRAMES[@]}"; do
  frame="${pair%%:*}" name="${pair##*:}"
  found=0
  for ext in avif jpg; do
    for w in 960 1600; do
      src="$SRC/$ext/$frame-$w.$ext"
      [ -f "$src" ] || continue
      cp "$src" "$DEST/$name-$w.$ext"; copied=$((copied+1)); found=1
    done
  done
  [ "$found" -eq 1 ] || missing+=("$frame")
done

echo "copied $copied files for ${#FRAMES[@]} frames -> $DEST"
if [ "${#missing[@]}" -gt 0 ]; then
  echo "WARNING missing frames: ${missing[*]}" >&2
  exit 1
fi
du -sh "$DEST"
