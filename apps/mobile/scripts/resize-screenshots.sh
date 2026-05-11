#!/bin/bash
#
# resize-screenshots.sh
#
# Resize iPhone screenshots taken from iPhone 17 Pro Max simulator (1320×2868)
# to App Store Connect accepted "iPhone 6.5\" Display" size (1284×2778).
#
# Usage:
#   1. Run app on iPhone 17 Pro Max simulator
#   2. Take screenshots (Cmd+S in Simulator) — saves to Desktop by default
#   3. Move them into ~/Desktop/myfng-screenshots/iphone-input/
#   4. Run this script: bash apps/mobile/scripts/resize-screenshots.sh
#   5. Output goes to ~/Desktop/myfng-screenshots/iphone-output/ at 1284×2778
#   6. Upload those to App Store Connect's "iPhone 6.5\" Display" section
#
# For iPad screenshots:
#   - Use iPad Pro 13-inch (M5) simulator → gives 2064×2752
#   - That's a valid size for App Store Connect's "iPad 13\" Display" section directly
#   - No resize needed
#
set -euo pipefail

INPUT_DIR="${1:-$HOME/Desktop/myfng-screenshots/iphone-input}"
OUTPUT_DIR="${2:-$HOME/Desktop/myfng-screenshots/iphone-output}"

# App Store Connect iPhone 6.5" Display accepted size (closest to 6.9" aspect ratio)
TARGET_W=1284
TARGET_H=2778

if [[ ! -d "$INPUT_DIR" ]]; then
  echo "ERROR: Input directory not found: $INPUT_DIR"
  echo ""
  echo "Please create it and place your iPhone screenshots inside:"
  echo "  mkdir -p \"$INPUT_DIR\""
  echo "  # Take screenshots in iPhone 17 Pro Max simulator (Cmd+S)"
  echo "  # Move PNG files from ~/Desktop/ to: $INPUT_DIR"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

count=0
for src in "$INPUT_DIR"/*.png "$INPUT_DIR"/*.PNG; do
  [[ -e "$src" ]] || continue
  name="$(basename "$src")"
  dst="$OUTPUT_DIR/${name%.*}-appstore.png"

  # sips: resample to target size (will preserve aspect by padding/cropping if needed)
  # We use -z which scales preserving aspect, then -p pads to exact target.
  # Easiest: use --resampleHeightWidth which forces exact size (may distort tiny amount).
  sips --resampleHeightWidth $TARGET_H $TARGET_W "$src" --out "$dst" >/dev/null

  echo "  ✓ $name → $(basename "$dst") (${TARGET_W}×${TARGET_H})"
  count=$((count + 1))
done

if [[ $count -eq 0 ]]; then
  echo "No PNG files found in $INPUT_DIR"
  exit 1
fi

echo ""
echo "Done! $count screenshots resized to ${TARGET_W}×${TARGET_H}."
echo "Output: $OUTPUT_DIR"
echo ""
echo "Next: drag these PNGs into App Store Connect → iPhone 6.5\" Display section."
