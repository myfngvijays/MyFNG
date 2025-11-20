v#!/bin/bash

# MyFNG - Start on Android Emulator
# Run karo: ./start-emulator.sh

echo "🚀 MyFNG Mobile - Starting on Emulator..."
echo ""

# Navigate to mobile app
cd "$(dirname "$0")/apps/mobile" || exit

echo "Step 1: Checking Android emulator..."
echo ""

# Check if emulator is running
if command -v adb &> /dev/null; then
    DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l)
    if [ "$DEVICES" -gt 0 ]; then
        echo "✅ Android emulator detected!"
        echo ""
    else
        echo "⚠️  No emulator running!"
        echo ""
        echo "Please start your Android emulator first:"
        echo "  • Open Android Studio"
        echo "  • Tools → Device Manager"
        echo "  • Start any emulator"
        echo ""
        echo "Or run: emulator -avd <emulator-name>"
        echo ""
        read -p "Press Enter when emulator is ready..."
    fi
else
    echo "⚠️  ADB not found in PATH"
    echo ""
    echo "Please make sure Android SDK is installed:"
    echo "  • Install Android Studio"
    echo "  • Or install SDK command-line tools"
    echo ""
    echo "Adding to PATH (for this session):"
    export ANDROID_HOME=$HOME/Library/Android/sdk
    export PATH=$PATH:$ANDROID_HOME/emulator
    export PATH=$PATH:$ANDROID_HOME/platform-tools
    echo "  ✓ ANDROID_HOME set"
    echo ""
fi

echo "Step 2: Starting Expo with Android..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App will open automatically on emulator"
echo "  Hot reload enabled - changes will reflect live"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start with Android flag
npx expo start --android --clear

# Alternative: If above doesn't work, use this:
# npx expo start
# Then press 'a' to open on Android emulator

