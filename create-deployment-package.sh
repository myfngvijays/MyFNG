#!/bin/bash

echo "📦 Creating deployment package for Hostinger..."
echo ""

cd apps/web || exit 1

# Create deployment directory
DEPLOY_DIR="../../myfng-hostinger-deployment"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

echo "📋 Copying build files..."
cp -R .next "$DEPLOY_DIR/"
cp -R public "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp next.config.js "$DEPLOY_DIR/"
cp postcss.config.js "$DEPLOY_DIR/"
cp tailwind.config.ts "$DEPLOY_DIR/"
cp tsconfig.json "$DEPLOY_DIR/"

echo "📝 Creating environment file..."
cat > "$DEPLOY_DIR/.env.production" << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U
NEXT_PUBLIC_APP_URL=https://myfng.astric.ai
NEXT_PUBLIC_API_URL=https://myfng.astric.ai
EOF

echo "📝 Creating startup script..."
cat > "$DEPLOY_DIR/start.sh" << 'STARTSCRIPT'
#!/bin/bash
echo "🚀 Starting MyFNG on Hostinger..."
npm install --production
npm start
STARTSCRIPT
chmod +x "$DEPLOY_DIR/start.sh"

echo "📝 Creating README..."
cat > "$DEPLOY_DIR/DEPLOY_TO_HOSTINGER.md" << 'README'
# Deploy MyFNG to Hostinger

## Quick Start

1. Upload all files in this folder to your Hostinger public_html directory
2. SSH into your server (or use Hostinger's terminal)
3. Run: npm install --production
4. Run: npm start

## What's Included

- .next/ - Production build
- public/ - Static assets
- .env.production - Environment variables
- package.json - Dependencies
- All config files

## Server Requirements

- Node.js 18+ (Node.js 20+ recommended)
- npm installed
- Port 3000 available (or configure different port)

## Starting the App

### Option 1: Direct Start
```bash
npm install --production
npm start
```

### Option 2: With PM2 (Recommended for production)
```bash
npm install -g pm2
npm install --production
pm2 start npm --name "myfng" -- start
pm2 save
pm2 startup
```

### Option 3: Using the start script
```bash
chmod +x start.sh
./start.sh
```

## Environment Variables

Already configured in .env.production:
- Supabase URL and Key
- App URL: https://myfng.astric.ai
- API URL: https://myfng.astric.ai

## Troubleshooting

### Port Issues
If port 3000 is in use, modify package.json:
```json
"start": "next start -p 8080"
```

### Memory Issues
Increase Node.js memory:
```json
"start": "NODE_OPTIONS='--max-old-space-size=4096' next start"
```

### Permission Issues
```bash
chmod -R 755 .next
chmod -R 755 public
```

## Accessing the App

After starting:
- Local: http://localhost:3000
- Public: https://myfng.astric.ai

Make sure your domain DNS points to your Hostinger server IP.

## Support

- Check Hostinger documentation for Node.js hosting
- Ensure SSL certificate is active
- Configure reverse proxy if needed (Apache/Nginx)
README

echo ""
echo "✅ Deployment package created!"
echo ""
echo "📁 Location: $DEPLOY_DIR"
echo "📊 Package contents:"
ls -lh "$DEPLOY_DIR" | tail -n +2
echo ""
echo "📦 Total size:"
du -sh "$DEPLOY_DIR"
echo ""
echo "🎯 Next Steps:"
echo "1. Compress the folder: cd .. && zip -r myfng-deployment.zip myfng-hostinger-deployment/"
echo "2. Upload to Hostinger File Manager"
echo "3. Extract on server"
echo "4. Run: npm install --production && npm start"
echo ""
