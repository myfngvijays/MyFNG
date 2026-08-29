#!/bin/bash
# Android Studio's Gradle daemon PATH is typically $JAVA_HOME/bin:/usr/bin:/bin.
# This overlay is a JDK that also has `node`, so Expo scripts that call bare `node` work.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="$ROOT/.studio-jdk"
JBR="${STUDIO_JBR_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
NODE="${NODE_BINARY:-}"

if [[ -z "$NODE" && -f "$ROOT/local.properties" ]]; then
  NODE="$(sed -n 's/^node.executable=//p' "$ROOT/local.properties" | tr -d '\r')"
fi
if [[ -z "$NODE" || ! -x "$NODE" ]]; then
  for candidate in "$HOME/nodejs/bin/node" /usr/local/bin/node /opt/homebrew/bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE="$candidate"
      break
    fi
  done
fi

if [[ ! -d "$JBR/bin" ]]; then
  echo "Android Studio JBR not found at: $JBR" >&2
  exit 1
fi
if [[ ! -x "$NODE" ]]; then
  echo "node executable not found. Set NODE_BINARY or android/local.properties node.executable" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST/bin"
for f in "$JBR/bin/"*; do
  ln -sf "$f" "$DEST/bin/$(basename "$f")"
done
ln -sf "$NODE" "$DEST/bin/node"
if [[ -x "$(dirname "$NODE")/npm" ]]; then
  ln -sf "$(dirname "$NODE")/npm" "$DEST/bin/npm"
fi
ln -sfn "$JBR/lib" "$DEST/lib"
ln -sfn "$JBR/conf" "$DEST/conf"
[[ -d "$JBR/legal" ]] && ln -sfn "$JBR/legal" "$DEST/legal"
ln -sf "$JBR/release" "$DEST/release"

echo "Studio JDK overlay ready: $DEST"
echo "  java -> $($DEST/bin/java -version 2>&1 | head -1)"
echo "  node -> $($DEST/bin/node -v)"
