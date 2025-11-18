# 🚀 MyFNG - Hostinger Deployment Instructions

## ✅ Build Status: COMPLETE

Your MyFNG application has been successfully built and is ready for deployment to **myfng.astric.ai**

---

## 📦 What's Been Created

### 1. **Deployment Package**
- **File:** `myfng-deployment.zip`
- **Location:** `/Users/roadserve/Downloads/MyFNG/`
- **Size:** ~50-60 MB (compressed)
- **Contents:** Production build + all necessary files

### 2. **Build Output**
- **Production Build:** `.next/` folder (155 MB)
- **Static Assets:** Optimized and ready
- **24 Pages:** All routes compiled successfully
- **Environment:** Production variables configured

---

## 🎯 Deployment Steps to Hostinger

### Step 1: Upload to Hostinger

**Option A: File Manager (Easiest)**
1. Login to Hostinger Control Panel
2. Go to **File Manager**
3. Navigate to `public_html` folder
4. Click **Upload** button
5. Select `myfng-deployment.zip`
6. Wait for upload to complete
7. Right-click zip file → **Extract**
8. Move contents of `myfng-hostinger-deployment` folder to root

**Option B: FTP (Faster for large files)**
1. Open FTP client (FileZilla recommended)
2. Connect to Hostinger:
   - Host: Your domain or FTP hostname
   - Username: Your FTP username
   - Password: Your FTP password
   - Port: 21
3. Navigate to `public_html`
4. Drag and drop `myfng-hostinger-deployment` folder
5. Wait for transfer to complete

### Step 2: Setup Node.js on Hostinger

1. Go to Hostinger Control Panel
2. Find **Node.js Manager** (or similar)
3. Select your domain: `myfng.astric.ai`
4. Choose Node.js version: **18.x or higher** (20.x recommended)
5. Set Application Root: `/public_html` (or your upload directory)
6. Set Application Startup File: (leave as default or set to server.js if needed)
7. Click **Enable Node.js**

### Step 3: Install Dependencies

**Via Hostinger Terminal/SSH:**
```bash
# Connect to your server
ssh username@your-server.com

# Navigate to your app directory
cd ~/public_html

# Install production dependencies
npm install --production

# This will install ~211 MB of node_modules
```

**Via Hostinger Control Panel:**
1. Go to **Advanced** → **Terminal** or **SSH Access**
2. Open terminal
3. Run the commands above

### Step 4: Start the Application

**Option A: Simple Start**
```bash
npm start
```

**Option B: Using PM2 (Recommended for Production)**
```bash
# Install PM2 globally
npm install -g pm2

# Start the app
pm2 start npm --name "myfng" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server reboot
pm2 startup
```

**Option C: Using the provided start script**
```bash
chmod +x start.sh
./start.sh
```

### Step 5: Configure Domain & SSL

1. **DNS Configuration:**
   - Point `myfng.astric.ai` to your Hostinger server IP
   - Wait for DNS propagation (can take up to 48 hours, usually faster)

2. **SSL Certificate:**
   - In Hostinger Control Panel → **SSL**
   - Enable **Free SSL** for `myfng.astric.ai`
   - Wait for certificate installation

3. **Force HTTPS:**
   - Create/Edit `.htaccess` in public_html
   - Add HTTPS redirect (see HOSTINGER_DEPLOYMENT.md for code)

### Step 6: Reverse Proxy Configuration

If Hostinger uses Apache, you may need to configure reverse proxy:

**Create/Edit .htaccess:**
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

RewriteCond %{HTTP_HOST} ^myfng\.astric\.ai [NC]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Site loads at `https://myfng.astric.ai`
- [ ] No SSL warnings
- [ ] Login page displays correctly
- [ ] Can login with Supabase credentials
- [ ] All dashboards load:
  - [ ] Super Admin Dashboard
  - [ ] Workshop Admin Dashboard
  - [ ] Lead Manager Dashboard
  - [ ] Workshop Mechanic Dashboard
  - [ ] Workshop Pickup Boy Dashboard
  - [ ] Customer Dashboard
- [ ] Database connections work (Supabase)
- [ ] User management functions work
- [ ] Workshop staff management works
- [ ] All navigation links work
- [ ] Mobile responsive design works

---

## 📊 Build Statistics

```
Route Statistics:
- Total Pages: 24
- Super Admin: 7 pages
- Workshop Admin: 5 pages  
- Workshop Roles: 6 pages
- Other: 6 pages

Build Size:
- .next folder: 155 MB
- node_modules: 211 MB (after npm install)
- Total deployed: ~370 MB

First Load JS: 87.3 kB (shared)
Page sizes: 175 B to 4.73 kB
```

---

## 🔧 Troubleshooting

### Issue: Port 3000 already in use
**Solution:**
```bash
# Edit package.json, change start script to:
"start": "next start -p 8080"
```

### Issue: npm install fails
**Solution:**
```bash
# Clear npm cache and retry
npm cache clean --force
rm -rf node_modules
npm install --production
```

### Issue: App not accessible from domain
**Solutions:**
1. Check DNS has propagated: `nslookup myfng.astric.ai`
2. Verify reverse proxy configuration
3. Check Hostinger's Node.js app is running
4. Review Hostinger error logs

### Issue: 404 on page refresh
**Solution:** Configure .htaccess for client-side routing (see above)

### Issue: Environment variables not loaded
**Solution:**
```bash
# Verify .env.production exists
ls -la .env.production

# Check Hostinger reads .env.production
# May need to set in Hostinger control panel instead
```

### Issue: Database connection errors
**Solutions:**
1. Verify Supabase allows connections from Hostinger IP
2. Check environment variables are correct
3. Test connection: `curl https://cffommijlvicfjhbqyzk.supabase.co`

---

## 📱 Alternative: Static Export Option

If Hostinger doesn't support Node.js well, you can export as static HTML:

### 1. Modify Configuration
Edit `apps/web/next.config.js`:
```javascript
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
}
```

### 2. Rebuild
```bash
cd apps/web
npm run build
```

### 3. Deploy
Upload the `out/` folder contents to `public_html`

**Note:** Static export has limitations:
- No server-side rendering
- No API routes
- No dynamic features
- All pages pre-rendered

---

## 🎯 Environment Variables

Already configured in deployment package:

```env
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://myfng.astric.ai
NEXT_PUBLIC_API_URL=https://myfng.astric.ai
```

---

## 📞 Support Resources

- **Hostinger Support:** https://www.hostinger.com/tutorials/how-to-deploy-nodejs-app
- **Node.js Hosting:** https://support.hostinger.com/en/articles/node-js
- **SSL Setup:** https://support.hostinger.com/en/articles/ssl-certificate
- **Next.js Deployment:** https://nextjs.org/docs/deployment

---

## 🎊 Expected Result

Once deployed successfully:

1. **Public Access:** https://myfng.astric.ai
2. **Login Page:** Displays with MyFNG branding
3. **Role-Based Dashboards:** All 7 role types accessible
4. **Database:** Connected to Supabase
5. **SSL:** Green padlock, secure HTTPS
6. **Performance:** Fast loading, optimized assets
7. **Mobile:** Fully responsive on all devices

---

## 📋 Quick Commands Reference

```bash
# Connect to server
ssh user@myfng.astric.ai

# Navigate to app
cd ~/public_html

# Install dependencies
npm install --production

# Start app (simple)
npm start

# Start with PM2 (production)
pm2 start npm --name "myfng" -- start
pm2 save

# Check PM2 status
pm2 status

# View logs
pm2 logs myfng

# Restart app
pm2 restart myfng

# Stop app
pm2 stop myfng
```

---

## ✅ Deployment Complete!

Your MyFNG application is ready for production deployment!

**Package Location:** `/Users/roadserve/Downloads/MyFNG/myfng-deployment.zip`

**Next Action:** Upload to Hostinger and follow the steps above.

---

**Last Updated:** November 16, 2025  
**Build Status:** ✅ Success  
**Target Domain:** myfng.astric.ai  
**Deployment Platform:** Hostinger File Manager

