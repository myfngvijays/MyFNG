#!/usr/bin/env bash
# Android Studio emulator cannot reach the Mac LAN IP (192.168.x.x) or
# reliably use 10.0.2.2. Tunnel Metro through adb reverse and open 127.0.0.1.
set -euo pipefail

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
if [[ ! -x "$ADB" ]]; then
  echo "adb not found at $ADB"
  exit 1
fi

echo "Waiting for emulator..."
"$ADB" wait-for-device

# Device can be "attached" before ActivityManager is up (boot animation).
for _ in $(seq 1 60); do
  boot="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  if [[ "$boot" == "1" ]] && "$ADB" shell service check activity 2>/dev/null | grep -q 'found'; then
    break
  fi
  sleep 2
done

if ! "$ADB" shell service check activity 2>/dev/null | grep -q 'found'; then
  echo "Emulator booted but Android activity service is not ready. Try again in a few seconds."
  exit 1
fi

"$ADB" reverse tcp:8081 tcp:8081
"$ADB" reverse tcp:3000 tcp:3000
"$ADB" reverse --list

"$ADB" shell am force-stop com.myfng.app
"$ADB" shell am start -a android.intent.action.VIEW \
  -d 'com.myfng.app://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
  com.myfng.app

echo "Opened MyFNG → http://127.0.0.1:8081 (via adb reverse)"
echo "Keep Metro running: npm start   (in apps/mobile)"
