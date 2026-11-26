#!/usr/bin/env bash
# Regenerate Android launcher mipmaps from assets/partner-app-icon.png (Partner APK: APP_VARIANT=partner).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/partner-app-icon.png"
BASE="$ROOT/android/app/src/partner/res"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC — place 1024×1024 partner icon there first." >&2
  exit 1
fi

mkdir -p "$BASE/values" "$BASE/mipmap-anydpi-v26"
for spec in "mipmap-mdpi:48" "mipmap-hdpi:72" "mipmap-xhdpi:96" "mipmap-xxhdpi:144" "mipmap-xxxhdpi:192"; do
  dir="${spec%%:*}"
  sz="${spec##*:}"
  mkdir -p "$BASE/$dir"
  sips -z "$sz" "$sz" "$SRC" --out "$BASE/$dir/ic_launcher.png" >/dev/null
  cp "$BASE/$dir/ic_launcher.png" "$BASE/$dir/ic_launcher_round.png"
done
for spec in "mipmap-mdpi:108" "mipmap-hdpi:162" "mipmap-xhdpi:216" "mipmap-xxhdpi:324" "mipmap-xxxhdpi:432"; do
  dir="${spec%%:*}"
  fg="${spec##*:}"
  sips -z "$fg" "$fg" "$SRC" --out "$BASE/$dir/ic_launcher_foreground.png" >/dev/null
done

IOS_SET="$ROOT/ios/MyFNG/Images.xcassets/AppIconPartner.appiconset"
mkdir -p "$IOS_SET"
cp "$SRC" "$IOS_SET/App-Icon-1024x1024@1x.png"
echo "Partner icons synced (Android overlay + iOS AppIconPartner)."