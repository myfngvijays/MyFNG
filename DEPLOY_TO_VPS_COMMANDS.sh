#!/bin/bash

# ================================================================
# 🚀 DEPLOY TO HOSTINGER VPS - EXACT COMMANDS
# ================================================================
# Server IP: 72.61.224.186
# Ubuntu 24.04 LTS
# ================================================================

echo "════════════════════════════════════════════════════════════"
echo "   🚀 DEPLOYING TO HOSTINGER VPS"
echo "════════════════════════════════════════════════════════════"
echo ""

# ================================================================
# STEP 1: SSH INTO SERVER
# ================================================================
echo "📡 Connecting to server..."
ssh root@72.61.224.186 << 'ENDSSH'

echo ""
echo "✅ Connected to VPS!"
echo ""

# ================================================================
# STEP 2: NAVIGATE TO PROJECT
# ================================================================
echo "📂 Navigating to project directory..."

# Find project location (check common paths)
if [ -d "/var/www/MyFNG" ]; then
    cd /var/www/MyFNG
    echo "✅ Found project at: /var/www/MyFNG"
elif [ -d "/home/MyFNG" ]; then
    cd /home/MyFNG
    echo "✅ Found project at: /home/MyFNG"
elif [ -d "/root/MyFNG" ]; then
    cd /root/MyFNG
    echo "✅ Found project at: /root/MyFNG"
elif [ -d "~/MyFNG" ]; then
    cd ~/MyFNG
    echo "✅ Found project at: ~/MyFNG"
else
    echo "❌ Project not found! Please clone first:"
    echo "git clone https://github.com/myfngvijays/MyFNG.git"
    exit 1
fi

echo ""

# ================================================================
# STEP 3: PULL LATEST CODE
# ================================================================
echo "⬇️  Pulling latest code from GitHub..."
git pull origin main

if [ $? -eq 0 ]; then
    echo "✅ Code pulled successfully!"
else
    echo "❌ Git pull failed!"
    exit 1
fi

echo ""

# ================================================================
# STEP 4: INSTALL DEPENDENCIES
# ================================================================
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed!"
else
    echo "❌ npm install failed!"
    exit 1
fi

echo ""

# ================================================================
# STEP 5: BUILD WEB APP
# ================================================================
echo "🔨 Building web application..."
cd apps/web
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

cd ../..
echo ""

# ================================================================
# STEP 6: RESTART SERVER
# ================================================================
echo "🔄 Restarting application..."

# Check which process manager is running
if command -v pm2 &> /dev/null; then
    echo "Using PM2..."
    pm2 restart all
    pm2 save
    echo "✅ PM2 restarted!"
elif systemctl is-active --quiet myfng; then
    echo "Using systemd..."
    sudo systemctl restart myfng
    echo "✅ Systemd service restarted!"
elif docker ps | grep -q myfng; then
    echo "Using Docker..."
    docker-compose restart
    echo "✅ Docker containers restarted!"
else
    echo "⚠️  No process manager detected!"
    echo "Please restart your app manually"
fi

echo ""

# ================================================================
# STEP 7: CHECK STATUS
# ================================================================
echo "🔍 Checking application status..."

if command -v pm2 &> /dev/null; then
    pm2 status
elif systemctl is-active --quiet myfng; then
    systemctl status myfng --no-pager
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "   ✅ DEPLOYMENT COMPLETE!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🎉 Your Lead Manager implementation is now live!"
echo ""
echo "📋 NEXT STEP - RUN DATABASE MIGRATION:"
echo "   1. Go to: https://supabase.com/dashboard"
echo "   2. Select your project"
echo "   3. Click 'SQL Editor'"
echo "   4. Copy content from: database/FINAL_COMPLETE_MIGRATION.sql"
echo "   5. Paste and click 'Run'"
echo ""
echo "🔗 Test your site:"
echo "   https://your-domain.com/dashboard/lead_manager"
echo ""
echo "📊 Check logs:"
echo "   pm2 logs"
echo "   OR"
echo "   journalctl -u myfng -f"
echo ""
echo "════════════════════════════════════════════════════════════"

ENDSSH

