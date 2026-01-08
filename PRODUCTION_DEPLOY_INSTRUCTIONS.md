# 🚀 Production Deployment Instructions - Fix 404 Errors

## Problem
Static assets (CSS, JS files) are showing 404 errors because the production server doesn't have the latest build.

## Solution

### Option 1: If Using GitHub Auto-Deploy (Vercel/Netlify)

If you have auto-deployment set up, it should automatically rebuild after git push. Wait 2-3 minutes and check again.

### Option 2: Manual Deployment to VPS/Hostinger

**Step 1: SSH into your server**
```bash
ssh root@YOUR_SERVER_IP
```

**Step 2: Navigate to your project**
```bash
cd /var/www/myfng/apps/web
# or wherever your project is located
```

**Step 3: Pull latest code**
```bash
git pull origin main
```

**Step 4: Install dependencies (if needed)**
```bash
npm install
```

**Step 5: Build production**
```bash
npm run build
```

**Step 6: Restart your Next.js server**
```bash
# If using PM2:
pm2 restart myfng-web

# If using systemd:
sudo systemctl restart myfng-web

# If using npm start directly:
# Kill the old process and restart:
npm start
```

### Option 3: Quick Fix (If build already exists)

If you already have `.next` folder but it's not being served:

**Check Next.js config:**
```bash
# Make sure your next.config.js has:
module.exports = {
  output: 'standalone', // or remove this if using default
  // ... other config
}
```

**Check server is serving static files:**
- Make sure your web server (nginx/apache) is configured to serve `_next/static` folder
- Check file permissions: `chmod -R 755 .next`

**Check .env.production:**
```bash
# Make sure these are set:
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NODE_ENV=production
```

### Option 4: Rebuild Using Provided Script

```bash
cd /Users/roadserve/Downloads/MyFNG
chmod +x build-for-production.sh
./build-for-production.sh

# Then upload the .next folder to server
```

---

## Quick Checklist

- [ ] Pulled latest code from git
- [ ] Installed dependencies (`npm install`)
- [ ] Built production (`npm run build`)
- [ ] `.next` folder exists and has content
- [ ] Restarted Next.js server
- [ ] Checked `.env.production` exists
- [ ] Verified server can serve static files from `_next/static`

---

## Verify Build Success

After rebuilding, check:
1. `.next` folder exists
2. `.next/static` folder has CSS/JS files
3. Server logs show "Ready" message
4. Visit `https://myfng.cloud` and check browser console for errors

---

**Note:** The 404 errors are happening because:
- Browser is requesting: `https://myfng.cloud/_next/static/css/...`
- Server doesn't have these files (old build or missing `.next` folder)
- Solution: Rebuild and deploy the `.next` folder


