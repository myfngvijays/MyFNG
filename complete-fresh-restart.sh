#!/bin/bash

# Complete Fresh Restart - Nuclear Option!

echo "🔥 COMPLETE FRESH RESTART 🔥"
echo ""
echo "This will:"
echo "  1. Kill all Expo/Metro processes"
echo "  2. Clear ALL caches"
echo "  3. Uninstall app from emulator"
echo "  4. Reinstall dependencies"
echo "  5. Start fresh"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

cd "$(dirname "$0")/apps/mobile" || exit

echo "Step 1: Killing all processes..."
pkill -9 -f expo 2>/dev/null || true
pkill -9 -f metro 2>/dev/null || true
pkill -9 -f node 2>/dev/null || true
sleep 3
echo "✅ All processes killed"

echo ""
echo "Step 2: Clearing ALL caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf /tmp/metro-* 2>/dev/null || true
rm -rf /tmp/haste-map-* 2>/dev/null || true
rm -rf /tmp/react-native-* 2>/dev/null || true
rm -rf ~/.expo/metro-cache 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true
echo "✅ All caches cleared"

echo ""
echo "Step 3: Uninstalling app from emulator..."
adb uninstall com.myfng.app 2>/dev/null || true
adb uninstall host.exp.exponent 2>/dev/null || true
echo "✅ App uninstalled"

echo ""
echo "Step 4: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "✅ Dependencies OK"
fi

echo ""
echo "Step 5: Starting COMPLETELY FRESH..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔥 Everything cleared - Fresh start!"
echo "  📱 App will reinstall on emulator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start completely fresh
npx expo start --android --clear --reset-cache

echo ""
echo "✅ Done!"

