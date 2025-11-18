#!/bin/bash

# MyFNG Web App - Automatic Setup & Launch Script
# This script will clean, install dependencies, and start the web app

echo "🚀 MyFNG Web App - Starting Setup..."
echo ""

# Navigate to web app folder
cd "$(dirname "$0")/apps/web" || exit

echo "📦 Step 1: Cleaning old files..."
rm -rf node_modules .next package-lock.json 2>/dev/null
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
if [ ! -f .env.local ]; then
    cat > .env.local << 'EOF'
# Add your Supabase credentials here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    echo "✅ .env.local created! Please add your Supabase credentials."
    echo ""
    echo "📝 Edit this file: apps/web/.env.local"
    echo "   Get credentials from: Supabase Dashboard → Settings → API"
    echo ""
    read -p "Press Enter after adding credentials to continue..."
fi

echo ""
echo "🚀 Step 4: Starting development server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   MyFNG Web App will start at:"
echo "   🌐 http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev

