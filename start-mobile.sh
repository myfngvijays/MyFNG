#!/bin/bash

# MyFNG Mobile App - Automatic Setup & Launch Script
# This script will clean, install dependencies, and start the mobile app

echo "📱 MyFNG Mobile App - Starting Setup..."
echo ""

# Navigate to mobile app folder
cd "$(dirname "$0")/apps/mobile" || exit

echo "📦 Step 1: Cleaning old files..."
rm -rf node_modules package-lock.json 2>/dev/null
echo "✅ Cleanup complete!"
echo ""

echo "📦 Step 2: Installing dependencies..."
echo "⏳ This might take 2-3 minutes..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install failed. Trying with legacy peer deps..."
    npm install --legacy-peer-deps
fi
echo "✅ Dependencies installed!"
echo ""

echo "🎨 Step 3: Creating environment file..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# Add your Supabase credentials here
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EOF
    echo "✅ .env created! Please add your Supabase credentials."
    echo ""
    echo "📝 Edit this file: apps/mobile/.env"
    echo "   Get credentials from: Supabase Dashboard → Settings → API"
    echo ""
    read -p "Press Enter after adding credentials to continue..."
fi

echo ""
echo "🚀 Step 4: Starting Expo development server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Scan QR code with Expo Go app"
echo "   📱 iOS: Expo Go from App Store"
echo "   🤖 Android: Expo Go from Play Store"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start Expo
npx expo start --clear

