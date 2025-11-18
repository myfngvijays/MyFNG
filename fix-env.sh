#!/bin/bash

echo "🔧 Fixing .env.local for Web App..."
echo ""

cd /Users/roadserve/Downloads/MyFNG/apps/web

# Backup old file if exists
if [ -f .env.local ]; then
    mv .env.local .env.local.backup
    echo "✅ Old .env.local backed up to .env.local.backup"
fi

# Create new .env.local with correct NEXT_PUBLIC_ prefix
cat > .env.local << 'EOF'
# MyFNG Web App Environment Variables
# Use NEXT_PUBLIC_ prefix for Next.js (NOT EXPO_PUBLIC_)

NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4NDQ0NjksImV4cCI6MjA0NzQyMDQ2OX0.qFl9kIm45BHuqKCZCHRiCl3UZpvgzORuPrUdPMFJK_0
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "✅ New .env.local created with NEXT_PUBLIC_ prefix!"
echo ""
echo "📝 File content:"
cat .env.local
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ .env.local fixed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Now restart your server:"
echo "   1. Stop server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo ""

