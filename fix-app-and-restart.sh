#!/bin/bash

# MyFNG - Fix Common Errors & Restart App
# Agar "main has not been registered" ya similar error aaye

echo "🔧 Fixing common errors..."
echo ""

# Navigate to mobile app
cd "$(dirname "$0")/apps/mobile" || exit

echo "Step 1: Stopping all running processes..."
pkill -f "expo" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
sleep 2
echo "✅ Processes stopped"
echo ""

echo "Step 2: Clearing cache..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf /tmp/metro-* 2>/dev/null || true
echo "✅ Cache cleared"
echo ""

echo "Step 3: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules missing, installing..."
    npm install
else
    echo "✅ Dependencies OK"
fi
echo ""

echo "Step 4: Starting fresh..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App will open on emulator"
echo "  All cache cleared - fresh start!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start with full cache clear
npx expo start --android --clear

echo ""
echo "✅ Done! App should be running now."

