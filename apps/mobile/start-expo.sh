#!/bin/bash

echo "🚀 Starting Expo Dev Server..."
echo ""

cd /Users/roadserve/Downloads/MyFNG/apps/mobile

# Kill any existing processes
pkill -f expo 2>/dev/null
pkill -f metro 2>/dev/null
sleep 1

echo "📁 Location: $(pwd)"
echo "📱 Starting Expo with tunnel mode..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Expo
npx expo start --tunnel

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

