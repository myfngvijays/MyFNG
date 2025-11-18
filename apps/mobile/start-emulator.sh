#!/bin/bash

echo "📱 Starting MyFNG on Pixel 7 Emulator..."
echo ""

# Check if emulator is running
if ! command -v adb &> /dev/null; then
    echo "❌ Android SDK not found!"
    echo "Please install Android Studio first."
    exit 1
fi

# List available emulators
echo "📋 Available emulators:"
emulator -list-avds

echo ""
echo "🚀 Starting Pixel 7 emulator..."
echo ""

# Start emulator in background (change name if needed)
# emulator -avd Pixel_7_API_33 &

echo "⏳ Waiting for emulator to boot..."
adb wait-for-device

echo "✅ Emulator ready!"
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🚀 Starting Expo on Android..."
npx expo start --android

