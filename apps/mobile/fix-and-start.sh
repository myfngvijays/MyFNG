#!/bin/bash

echo "🔧 Fixing assets and starting app..."
echo ""

cd /Users/roadserve/Downloads/MyFNG/apps/mobile || exit 1

# Create assets directory if not exists
mkdir -p assets

echo "✅ Assets folder ready"
echo ""
echo "🚀 Starting Expo..."
echo ""
echo "📱 Press 'a' when Metro bundler is ready!"
echo ""

npx expo start --clear

