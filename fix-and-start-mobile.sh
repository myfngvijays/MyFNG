#!/bin/bash

echo "🔧 MyFNG Mobile App - Complete Fix & Launch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project root
cd "$(dirname "$0")" || exit

echo "📦 Step 1: Cleaning EVERYTHING (root + mobile)..."
rm -rf node_modules package-lock.json 2>/dev/null
rm -rf apps/mobile/node_modules apps/mobile/package-lock.json 2>/dev/null
echo "✅ Cleanup complete!"
echo ""

# Go to mobile folder
cd apps/mobile || exit

echo "📦 Step 2: Installing mobile dependencies (with legacy peer deps)..."
echo "⏳ This will take 2-3 minutes..."
npm install --legacy-peer-deps
echo ""

echo "📦 Step 3: Installing missing modules explicitly..."
npm install es-abstract --legacy-peer-deps
echo "✅ All dependencies installed!"
echo ""

echo "🎨 Step 4: Checking environment file..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# Add your Supabase credentials here
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EOF
    echo "✅ .env created!"
    echo ""
    echo "⚠️  IMPORTANT: Add your Supabase credentials!"
    echo "   File: apps/mobile/.env"
    echo "   Get from: Supabase Dashboard → Settings → API"
    echo ""
fi

echo "🚀 Step 5: Starting Expo development server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✨ MyFNG Mobile App"
echo "   📱 Scan QR code with Expo Go"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npx expo start --clear

