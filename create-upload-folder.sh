#!/bin/bash

echo "📦 Creating upload folder for Hostinger..."
echo ""

# Create upload directory
UPLOAD_DIR="/Users/roadserve/Downloads/MyFNG-UPLOAD-TO-HOSTINGER"
rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"

cd /Users/roadserve/Downloads/MyFNG/apps/web || exit 1

echo "📋 Copying .next folder (build)..."
cp -R .next "$UPLOAD_DIR/"

echo "📋 Copying src folder..."
cp -R src "$UPLOAD_DIR/"

echo "📋 Copying config files..."
cp package.json "$UPLOAD_DIR/"
[ -f package-lock.json ] && cp package-lock.json "$UPLOAD_DIR/"
cp next.config.js "$UPLOAD_DIR/"
cp postcss.config.js "$UPLOAD_DIR/"
cp tailwind.config.ts "$UPLOAD_DIR/"
cp tsconfig.json "$UPLOAD_DIR/"

echo "📝 Creating .env.production..."
cat > "$UPLOAD_DIR/.env.production" << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U
NEXT_PUBLIC_APP_URL=https://myfng.astric.ai
NEXT_PUBLIC_API_URL=https://myfng.astric.ai
EOF

echo "📝 Creating README..."
cat > "$UPLOAD_DIR/UPLOAD-INSTRUCTIONS.txt" << 'README'
=======================================================
MyFNG - HOSTINGER UPLOAD INSTRUCTIONS
=======================================================

📦 Ye folder me saare files hain jo upload karne hain!

🚀 UPLOAD STEPS:
-----------------

1. Hostinger File Manager me login karo
2. public_html/myfng folder me jao
3. Is folder ki SAARI FILES upload karo
4. Upload complete hone ke baad:

   Terminal/SSH me ye commands run karo:
   
   cd ~/public_html/myfng
   npm install --production
   npm start

   Ya phir PM2 se (recommended):
   
   pm2 start npm --name "myfng" -- start
   pm2 save

📁 IS FOLDER ME KYA HAI:
-------------------------
✅ .next/              - Build files (SABSE IMPORTANT!)
✅ src/                - Source code
✅ .env.production     - Environment variables
✅ package.json        - Dependencies list
✅ All config files    - next.config.js, etc.

⚠️  IMPORTANT:
--------------
- Puri folder upload karo, koi file chhodo mat!
- .next folder ZAROORI hai - iske bina app nahi chalega!
- node_modules upload NAHI karna - server pe npm install karega

🌐 SITE URL:
------------
https://myfng.astric.ai

Done! 🎉
README

echo ""
echo "✅ Upload folder ready!"
echo ""
echo "📁 Location: $UPLOAD_DIR"
echo ""
echo "📊 Folder contents:"
ls -lh "$UPLOAD_DIR"
echo ""
echo "📦 Total size:"
du -sh "$UPLOAD_DIR"
echo ""
echo "🎯 Ab is folder ko Hostinger pe upload karo!"
echo ""

# Open folder in Finder
open "$UPLOAD_DIR"

