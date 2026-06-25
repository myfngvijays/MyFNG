#!/usr/bin/env bash
# Print SHA-1 / SHA-256 for Firebase Console → Project settings → Android app → Add fingerprint
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEBUG_KS="$ROOT/android/app/debug.keystore"
RELEASE_KS="$ROOT/android/app/myfng-release.keystore"

print_sha() {
  local label="$1"
  local ks="$2"
  local pass="$3"
  local alias="$4"
  if [[ ! -f "$ks" ]]; then
    echo "[$label] keystore not found: $ks"
    return
  fi
  echo "=== $label ($ks) ==="
  keytool -list -v -keystore "$ks" -storepass "$pass" -alias "$alias" 2>/dev/null | grep -E "Alias name|SHA1|SHA256" || echo "Could not read keystore"
  echo
}

print_sha "DEBUG (expo run / debug APK)" "$DEBUG_KS" android androiddebugkey

if [[ -f "$ROOT/android/signing.properties" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^MYFNG_RELEASE_' "$ROOT/android/signing.properties" | sed 's/\r$//')
fi

print_sha "RELEASE (signed APK)" "$RELEASE_KS" "${MYFNG_RELEASE_STORE_PASSWORD:-}" "${MYFNG_RELEASE_KEY_ALIAS:-myfng-key}"

echo "Also add Google Play → App integrity → App signing certificate SHA-1 (for Play Store builds)."
