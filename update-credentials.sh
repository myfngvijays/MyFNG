#!/bin/bash

echo "🔧 Updating Supabase credentials with correct anon key..."
echo ""

cd /Users/roadserve/Downloads/MyFNG/apps/web

# Backup current file
cp .env.local .env.local.old

# Create updated .env.local with CORRECT anon key
cat > .env.local << 'EOF'
# MyFNG Web App Environment Variables
# Updated with correct anon key from Supabase Dashboard

NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "✅ Credentials updated successfully!"
echo ""
echo "📝 New .env.local content:"
cat .env.local
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Ready to go!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

