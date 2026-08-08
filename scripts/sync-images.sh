#!/usr/bin/env bash
# Copy only the frames the site actually references into public/img.
# Keeping the repo lean matters: the full derivative set is ~170MB, the site needs ~35MB.
set -euo pipefail

SRC="${1:-/home/claude/gss/assets}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/img"
mkdir -p "$DEST"

# Every frame referenced from index.html or main.ts.
FRAMES=(
  IMG_6070 IMG_6071            # storefront
  IMG_6074 IMG_6077 IMG_6078   # shelves, glass
  IMG_6079 IMG_6080            # interior wides
  IMG_6083 IMG_6084            # pouches, papers
  IMG_6081 IMG_6087 IMG_6089 IMG_6090  # hookah, accessories, humidor
  IMG_6092 IMG_6093 IMG_6094   # vape walls
)

# AVIF and WebP at 960 and 1600; JPEG only at 1600 as the last-resort fallback.
# Nothing larger ships: no section image renders wider than ~52vw, so 1600 already
# covers a 2x display. The hero has its own art-directed plates in public/img.
copied=0 missing=()
for f in "${FRAMES[@]}"; do
  found=0
  for ext in avif jpg; do
    for w in 960 1600; do
      src="$SRC/$ext/$f-$w.$ext"
      [ -f "$src" ] || continue
      cp "$src" "$DEST/"; copied=$((copied+1)); found=1
    done
  done
  [ "$found" -eq 1 ] || missing+=("$f")
done

echo "copied $copied files for ${#FRAMES[@]} frames -> $DEST"
if [ "${#missing[@]}" -gt 0 ]; then
  echo "WARNING missing frames: ${missing[*]}" >&2
  exit 1
fi
du -sh "$DEST"
