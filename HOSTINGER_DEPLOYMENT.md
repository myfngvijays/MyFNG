# MyFNG - Hostinger Deployment Guide

## 🚀 Deploying to myfng.astric.ai

This guide will help you deploy your MyFNG application to Hostinger file manager.

---

## 📋 Prerequisites

1. **Hostinger Account** with access to:
   - File Manager
   - Node.js support (check your hosting plan)
   - SSH access (recommended)

2. **Domain Setup**:
   - Domain: `myfng.astric.ai`
   - DNS configured to point to your Hostinger server
   - SSL certificate (Hostinger provides free SSL)

---

## 🔧 Option 1: Deploying with Node.js (Recommended)

### Step 1: Build the Application

Run the build script locally:

```bash
cd /Users/roadserve/Downloads/MyFNG
chmod +x build-for-production.sh
./build-for-production.sh
```

### Step 2: Prepare Files for Upload

Create a deployment package with these files/folders:
```
deployment-package/
├── .next/                 (build output)
├── public/               (static assets)
├── node_modules/         (dependencies)
├── package.json
├── package-lock.json
├── next.config.js
├── .env.production
└── postcss.config.js
```

### Step 3: Upload to Hostinger

**Via File Manager:**
1. Login to Hostinger control panel
2. Go to File Manager
3. Navigate to `public_html` or your domain folder
4. Upload all files/folders listed above
5. Wait for upload to complete (may take time for node_modules)

**Via FTP (Faster for large files):**
1. Use FileZilla or similar FTP client
2. Connect to your Hostinger FTP
3. Upload all files to the correct directory
4. Maintain folder structure

### Step 4: Setup on Hostinger

**Via SSH (if available):**
```bash
# Connect to your server
ssh username@your-server.com

# Navigate to your app directory
cd /path/to/your/app

# Install dependencies (if not uploaded)
npm install --production

# Start the application
npm start
```

**Configure Port:**
- Next.js runs on port 3000 by default
- You may need to configure reverse proxy or use a different port
- Check Hostinger's Node.js documentation for specific setup

---

## 🔧 Option 2: Static Export (Simpler but Limited)

If Hostinger doesn't support Node.js well, you can export as static files.

### Step 1: Modify next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

module.exports = nextConfig
```

### Step 2: Build Static Export

```bash
cd apps/web
npm run build
```

This creates an `out/` folder with static HTML/CSS/JS files.

### Step 3: Upload to Hostinger

1. Go to File Manager
2. Upload entire `out/` folder contents to `public_html`
3. Setup `.htaccess` for routing (see below)

### Step 4: Configure .htaccess

Create `.htaccess` in public_html:

```apache
# MyFNG - Hostinger .htaccess Configuration

# Enable Rewrite Engine
RewriteEngine On
RewriteBase /

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Handle Client-Side Routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/api
RewriteRule ^(.*)$ /index.html [L]

# Security Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Cache Static Assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/x-javascript "access plus 1 month"
</IfModule>

# Gzip Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE text/javascript
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/json
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/atom_xml
    AddOutputFilterByType DEFLATE image/svg+xml
</IfModule>
```

---

## ⚠️ Important Notes

### Environment Variables
Make sure `.env.production` contains:
```
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U
NEXT_PUBLIC_APP_URL=https://myfng.astric.ai
NEXT_PUBLIC_API_URL=https://myfng.astric.ai
```

### Node.js Version
- Check Hostinger's supported Node.js version
- MyFNG requires Node.js 18+ 
- Select appropriate version in Hostinger control panel

### Database Setup
- Supabase is already configured
- Make sure your Supabase project allows connections from Hostinger's IP
- Test database connection after deployment

### SSL Certificate
- Enable SSL in Hostinger control panel
- Force HTTPS for security
- Update URLs to use https://

---

## 🔍 Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules/.cache
npm install
npm run build
```

### Upload Too Slow
- Use FTP instead of File Manager
- Compress folders before upload
- Upload node_modules separately or run npm install on server

### 404 Errors
- Check .htaccess is properly configured
- Verify all routes are included in build
- Check File Manager file permissions (755 for folders, 644 for files)

### Environment Variables Not Working
- Verify .env.production is uploaded
- Check that Hostinger reads the env file
- Variables must start with NEXT_PUBLIC_ to be available in browser

### App Not Starting
- Check Node.js is enabled in Hostinger
- Verify correct port configuration
- Check error logs in Hostinger control panel

---

## 📊 Deployment Checklist

### Pre-Deployment:
- [ ] All features tested locally
- [ ] Environment variables configured
- [ ] Production build successful
- [ ] No linting errors
- [ ] Database migrations complete

### During Deployment:
- [ ] Files uploaded to Hostinger
- [ ] .env.production uploaded
- [ ] File permissions set correctly
- [ ] SSL certificate enabled
- [ ] Domain DNS configured

### Post-Deployment:
- [ ] Site loads at https://myfng.astric.ai
- [ ] Login functionality works
- [ ] Database connection successful
- [ ] All dashboards accessible
- [ ] Mobile responsiveness verified
- [ ] HTTPS redirect working
- [ ] Performance optimized

---

## 🚀 Quick Deploy Commands

### Local Build:
```bash
cd /Users/roadserve/Downloads/MyFNG
chmod +x build-for-production.sh
./build-for-production.sh
```

### Create ZIP for Upload:
```bash
cd apps/web
zip -r myfng-deployment.zip .next public node_modules package.json package-lock.json next.config.js .env.production postcss.config.js -x "*.git*" -x "*node_modules/.cache*"
```

### FTP Upload (Example):
```bash
# Using lftp
lftp -u username,password ftp.yourhostinger.com
cd public_html
mirror -R /local/path/to/app /remote/path
bye
```

---

## 📞 Support Resources

- **Hostinger Support:** https://www.hostinger.com/tutorials
- **Next.js Docs:** https://nextjs.org/docs/deployment
- **Supabase Docs:** https://supabase.com/docs

---

## 🎯 Expected Result

Once deployed successfully, you should be able to:

1. Access the site at: **https://myfng.astric.ai**
2. See the login page
3. Login with Supabase credentials
4. Access all role-based dashboards
5. Perform all CRUD operations
6. View real-time data from Supabase

---

**Last Updated:** November 16, 2025  
**Version:** 1.0  
**Domain:** myfng.astric.ai  
**Deployment Target:** Hostinger File Manager

