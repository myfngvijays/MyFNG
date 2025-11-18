#!/bin/bash

echo "🚀 MyFNG - Production Build Script"
echo "===================================="
echo ""

# Navigate to web app directory
cd "$(dirname "$0")/apps/web" || exit 1

echo "📦 Step 1: Cleaning old build files..."
rm -rf .next out node_modules/.cache

echo ""
echo "📝 Step 2: Checking environment variables..."
if [ -f .env.production ]; then
    echo "✅ Production environment file found"
else
    echo "⚠️  Warning: .env.production not found"
fi

echo ""
echo "🔨 Step 3: Installing dependencies..."
npm install --production=false

echo ""
echo "🏗️  Step 4: Building production version..."
NODE_ENV=production npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "📁 Build output location: apps/web/.next"
    echo "📊 Build size:"
    du -sh .next
    echo ""
    echo "🌐 Ready for deployment to: myfng.astric.ai"
    echo ""
    echo "📋 Next Steps:"
    echo "1. The .next folder contains your production build"
    echo "2. You need Node.js on your Hostinger server to run this"
    echo "3. Upload the following to Hostinger:"
    echo "   - .next/ folder"
    echo "   - public/ folder"
    echo "   - node_modules/ folder"
    echo "   - package.json"
    echo "   - next.config.js"
    echo "   - .env.production"
    echo ""
    echo "4. On Hostinger, run: npm start"
    echo ""
else
    echo ""
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi

