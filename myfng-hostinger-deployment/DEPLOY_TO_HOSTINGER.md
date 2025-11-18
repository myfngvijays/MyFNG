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
