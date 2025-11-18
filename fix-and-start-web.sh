#!/bin/bash

echo "🔧 MyFNG Web App - Complete Fix & Launch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project root
cd "$(dirname "$0")" || exit

echo "📦 Step 1: Cleaning EVERYTHING (root + web)..."
rm -rf node_modules package-lock.json 2>/dev/null
rm -rf apps/web/node_modules apps/web/.next apps/web/package-lock.json 2>/dev/null
echo "✅ Cleanup complete!"
echo ""

# Go to web folder
cd apps/web || exit

echo "📦 Step 2: Installing web dependencies (with legacy peer deps)..."
echo "⏳ This will take 2-3 minutes..."
npm install --legacy-peer-deps
echo ""

echo "📦 Step 3: Installing missing modules explicitly..."
npm install caniuse-lite browserslist autoprefixer --legacy-peer-deps
echo "✅ All dependencies installed!"
echo ""

echo "🎨 Step 4: Checking environment file..."
if [ ! -f .env.local ]; then
    cat > .env.local << 'EOF'
# Add your Supabase credentials here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    echo "✅ .env.local created!"
    echo ""
    echo "⚠️  IMPORTANT: Add your Supabase credentials!"
    echo "   File: apps/web/.env.local"
    echo "   Get from: Supabase Dashboard → Settings → API"
    echo ""
fi

echo "🚀 Step 5: Starting development server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✨ MyFNG Web App"
echo "   🌐 http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev

