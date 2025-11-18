#!/bin/bash

# 🚀 MyFNG VPS Deployment Script
# This script automates the deployment to Hostinger VPS

echo "🚀 MyFNG VPS Deployment Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if VPS IP is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: VPS IP address required${NC}"
    echo "Usage: ./deploy-to-vps.sh YOUR_VPS_IP"
    echo "Example: ./deploy-to-vps.sh 123.45.67.89"
    exit 1
fi

VPS_IP=$1
VPS_USER="root"
VPS_PATH="/var/www/myfng"

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "   VPS IP: $VPS_IP"
echo "   User: $VPS_USER"
echo "   Path: $VPS_PATH"
echo ""

# Step 1: Build locally
echo -e "${YELLOW}🔨 Step 1: Building application locally...${NC}"
cd apps/web
npm install
npm run build
cd ../..
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Step 2: Create deployment package
echo -e "${YELLOW}📦 Step 2: Creating deployment package...${NC}"
mkdir -p deployment-package
cp -r apps/web/.next deployment-package/
cp -r apps/web/public deployment-package/
cp apps/web/package.json deployment-package/
cp apps/web/package-lock.json deployment-package/
cp apps/web/next.config.js deployment-package/
echo -e "${GREEN}✅ Package created!${NC}"
echo ""

# Step 3: Upload to VPS
echo -e "${YELLOW}📤 Step 3: Uploading to VPS...${NC}"
echo "   This may take a few minutes..."

# Create directory on VPS
ssh $VPS_USER@$VPS_IP "mkdir -p $VPS_PATH"

# Upload files
scp -r deployment-package/* $VPS_USER@$VPS_IP:$VPS_PATH/

echo -e "${GREEN}✅ Upload complete!${NC}"
echo ""

# Step 4: Setup on VPS
echo -e "${YELLOW}⚙️  Step 4: Setting up on VPS...${NC}"

ssh $VPS_USER@$VPS_IP << 'ENDSSH'
cd /var/www/myfng

# Install only production dependencies
npm install --production

# Create .env.local file
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
EOF

echo "✅ Environment file created (UPDATE YOUR KEYS!)"

# Stop existing PM2 process if running
pm2 delete myfng-web 2>/dev/null || true

# Start with PM2
pm2 start npm --name "myfng-web" -- start

# Save PM2 configuration
pm2 save

echo "✅ Application started with PM2"
ENDSSH

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up local files...${NC}"
rm -rf deployment-package
echo -e "${GREEN}✅ Cleanup done!${NC}"
echo ""

# Final instructions
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. SSH into VPS: ssh $VPS_USER@$VPS_IP"
echo "   2. Update Supabase keys: nano $VPS_PATH/.env.local"
echo "   3. Restart app: pm2 restart myfng-web"
echo "   4. Setup Nginx (follow guide in HOSTINGER_VPS_DEPLOYMENT_COMPLETE.md)"
echo "   5. Setup SSL certificate"
echo "   6. Access: https://myfng.cloud"
echo ""
echo -e "${GREEN}✅ All Done!${NC}"

