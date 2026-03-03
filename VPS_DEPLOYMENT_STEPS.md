# 🚀 HOSTINGER VPS DEPLOYMENT - SIMPLE STEPS

## Server Details:
- **IP:** 72.61.224.186
- **OS:** Ubuntu 24.04 LTS
- **Access:** ssh root@72.61.224.186

---

## 📋 STEP-BY-STEP COMMANDS

### 1️⃣ **SSH into Server**
```bash
ssh root@72.61.224.186
```
*(Enter password when prompted)*

---

### 2️⃣ **Find Your Project**

Try these locations to find your project:

```bash
# Option 1: Check /var/www
cd /var/www/MyFNG

# Option 2: Check /home
cd /home/MyFNG

# Option 3: Check /root
cd /root/MyFNG

# Option 4: Check home directory
cd ~/MyFNG
```

**अगर project नहीं मिला तो clone करो:**
```bash
cd /var/www
git clone https://github.com/myfngvijays/MyFNG.git
cd MyFNG
```

---

### 3️⃣ **Pull Latest Code**
```bash
git pull origin main
```

**Expected Output:**
```
From https://github.com/myfngvijays/MyFNG
 * branch            main       -> FETCH_HEAD
Updating d2686ee..50a3d21
Fast-forward
 28 files changed, 6339 insertions(+), 672 deletions(-)
 create mode 100644 COMPLETE_LEAD_FLOW_READY.md
 ...
```

---

### 4️⃣ **Install Dependencies**
```bash
npm install
```

**This will take 2-3 minutes...**

---

### 5️⃣ **Build the Application**
```bash
cd apps/web
npm run build
```

**This will take 3-5 minutes...**

**Expected Output:**
```
✓ Creating an optimized production build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    ...
└ ○ /dashboard/lead_manager              ...
```

---

### 6️⃣ **Go Back to Root**
```bash
cd ../..
pwd  # Should show /var/www/MyFNG or similar
```

---

### 7️⃣ **Restart the Application**

**Check what process manager you're using:**

#### **Option A: Using PM2 (Most Common)**
```bash
# Check if PM2 is running
pm2 list

# Restart all apps
pm2 restart all

# Save PM2 configuration
pm2 save

# Check status
pm2 status
```

#### PM2 process split for calling rollout
```bash
# Web app process should exist
pm2 start npm --name "myfng-web" -- start

# Optional dedicated bridge worker (when implemented as separate command)
# pm2 start npm --name "myfng-bridge" -- run bridge:start

pm2 save
pm2 status
```

#### **Option B: Using Systemd**
```bash
# Check if service exists
systemctl status myfng

# Restart service
sudo systemctl restart myfng

# Check status
sudo systemctl status myfng
```

#### **Option C: Using Docker**
```bash
# Check containers
docker ps

# Restart
docker-compose restart

# Check logs
docker-compose logs -f
```

#### **Option D: Manual Start (if nothing above works)**
```bash
cd apps/web
npm start &
```

---

### 8️⃣ **Verify Deployment**

```bash
# Check if app is running
curl http://localhost:3000

# Check logs (PM2)
pm2 logs

# OR check logs (systemd)
journalctl -u myfng -f

# Check process
ps aux | grep node
```

---

## 🔥 CRITICAL: RUN DATABASE MIGRATION

**⚠️ BEFORE TESTING, YOU MUST RUN THE DATABASE MIGRATION!**

### Steps:

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Login to your account
   - Select your MyFNG project

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy Migration SQL:**
   - Open this file on GitHub:
   - https://github.com/myfngvijays/MyFNG/blob/main/database/FINAL_COMPLETE_MIGRATION.sql
   - Click "Raw" button
   - Copy ALL the content (Ctrl+A, Ctrl+C)

4. **Run Migration:**
   - Paste in Supabase SQL Editor
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for completion (10-15 seconds)

5. **Verify Success:**
   - You should see green checkmarks ✅
   - Final message: "🎉 MIGRATION COMPLETED SUCCESSFULLY!"

---

## WhatsApp Calling Full Signaling Runtime Keys

Add these keys in `apps/web/.env.production` on the server:

```bash
WHATSAPP_CALLING_ENABLED=1
WHATSAPP_CALLING_FULL_SIGNALING=1
WHATSAPP_CALLING_BUSINESS_COUNTRY=IN
WHATSAPP_CALLING_SUPPORTED_COUNTRIES=IN
WHATSAPP_CALLING_ALLOWED_HOURS=

ASTERISK_BRIDGE_INTERNAL_URL=http://127.0.0.1:3000/api/internal/asterisk
ASTERISK_WEBHOOK_SECRET=replace_with_long_random_secret
ASTERISK_ARI_URL=http://127.0.0.1:8088
ASTERISK_ARI_USERNAME=replace_ari_user
ASTERISK_ARI_PASSWORD=replace_ari_password
ASTERISK_AMI_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=replace_ami_user
ASTERISK_AMI_SECRET=replace_ami_secret
```

After env update:
```bash
pm2 restart myfng-web
pm2 logs myfng-web --lines 120 --nostream
```

Health checks:
```bash
curl -s "http://127.0.0.1:3000/api/internal/asterisk/health" \
  -H "x-asterisk-webhook-secret: $ASTERISK_WEBHOOK_SECRET"
```

---

## 🧪 TEST YOUR DEPLOYMENT

### 1. **Test Website is Running:**
```bash
curl http://localhost:3000
# Should return HTML content
```

### 2. **Test from Browser:**
Open your browser and go to:
- `http://your-domain.com` (main site)
- `http://your-domain.com/dashboard/lead_manager` (new Lead Manager)

### 3. **Test Login:**
- Login as Lead Manager role
- You should see the new dashboard
- Try validating a lead
- Try assigning a workshop

---

## 📊 MONITORING

### Check Logs:
```bash
# PM2 logs
pm2 logs

# Systemd logs
journalctl -u myfng -f

# Docker logs
docker-compose logs -f
```

### Check System Resources:
```bash
# CPU and Memory
htop

# Disk space
df -h

# Network
netstat -tulpn | grep :3000
```

---

## 🚨 TROUBLESHOOTING

### Problem: "git pull" fails
```bash
# Solution: Check git status
git status

# If conflicts, reset
git stash
git pull origin main
```

### Problem: "npm install" fails
```bash
# Solution: Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Problem: "npm run build" fails
```bash
# Solution: Check logs
cd apps/web
npm run build 2>&1 | tee build.log
cat build.log
```

### Problem: App not starting
```bash
# Check if port is already in use
lsof -i :3000

# Kill old process
kill -9 <PID>

# Restart
pm2 restart all
```

---

## ✅ DEPLOYMENT CHECKLIST

After running all commands, verify:

- [ ] ✅ Git pull successful (latest code)
- [ ] ✅ Dependencies installed (no errors)
- [ ] ✅ Build completed (no errors)
- [ ] ✅ App restarted (process running)
- [ ] ✅ Database migration run (in Supabase)
- [ ] ✅ Website accessible (browser test)
- [ ] ✅ Lead Manager page loads
- [ ] ✅ Can login successfully
- [ ] ✅ No errors in logs

---

## 🎉 SUCCESS!

अगर सब ✅ हैं तो congratulations! 

Your Lead Manager implementation is now LIVE! 🚀

**Test it at:** `https://your-domain.com/dashboard/lead_manager`

---

## 📞 QUICK REFERENCE

**Connect to server:**
```bash
ssh root@72.61.224.186
```

**Navigate to project:**
```bash
cd /var/www/MyFNG
```

**Pull latest:**
```bash
git pull origin main
```

**Restart app:**
```bash
pm2 restart all
```

**Check logs:**
```bash
pm2 logs
```

---

**Need help?** Check the logs first! 
Most issues are logged there. 📝

