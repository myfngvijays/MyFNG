# 🚀 Hostinger VPS Deployment Guide - MyFNG Application

## ✅ Prerequisites
- Hostinger VPS (Ubuntu/Debian)
- Domain: myfng.cloud
- Supabase Project Credentials

---

## 🎯 PART 1: VPS Initial Setup

### Step 1: Connect to VPS via SSH

```bash
# From your local terminal (Mac Terminal)
ssh root@YOUR_VPS_IP

# Enter password when prompted
# Example: ssh root@123.45.67.89
```

### Step 2: Update System & Install Node.js

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v18.x.x
npm -v   # Should show 9.x.x or 10.x.x

# Install Git
sudo apt install -y git

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 3: Install Nginx (Web Server)

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

---

## 🎯 PART 2: Deploy Application

### Step 4: Clone Your Project

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone your GitHub repo (if you have pushed to GitHub)
# git clone https://github.com/YOUR_USERNAME/MyFNG.git

# OR if not in GitHub, we'll upload files via SFTP/SCP
# For now, create directory
mkdir -p myfng
cd myfng
```

### Step 5: Upload Files to VPS

**Option A: Using SCP (from your Mac Terminal - NEW TERMINAL WINDOW)**

```bash
# From your local Mac terminal (NOT SSH session)
cd /Users/roadserve/Downloads/MyFNG

# Upload entire project to VPS
scp -r . root@YOUR_VPS_IP:/var/www/myfng/

# This will take few minutes depending on file size
```

**Option B: Using FileZilla/Cyberduck**
1. Download FileZilla or Cyberduck
2. Connect to VPS using SFTP
3. Upload project files to `/var/www/myfng/`

### Step 6: Setup Environment Variables

```bash
# SSH back into VPS
cd /var/www/myfng/apps/web

# Create .env.local file
nano .env.local

# Paste this content (replace with your actual Supabase credentials):
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here

# Save: Ctrl+X, then Y, then Enter
```

### Step 7: Install Dependencies & Build

```bash
# Navigate to web app directory
cd /var/www/myfng/apps/web

# Install dependencies
npm install

# Build production version
npm run build

# This will create .next folder with standalone build
```

### Step 8: Start Application with PM2

```bash
# Start Next.js server with PM2
cd /var/www/myfng/apps/web
pm2 start npm --name "myfng-web" -- start

# Check if running
pm2 list

# View logs
pm2 logs myfng-web

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs
```

---

## 🎯 PART 3: Configure Domain & Nginx

### Step 9: Point Domain to VPS

**In Hostinger DNS Panel (hPanel):**

1. Go to Hostinger Dashboard → Domains → myfng.cloud → DNS
2. Add/Update A Record:
   ```
   Type: A
   Name: @
   Value: YOUR_VPS_IP
   TTL: 3600
   ```
3. Add/Update A Record for www:
   ```
   Type: A
   Name: www
   Value: YOUR_VPS_IP
   TTL: 3600
   ```
4. Save changes (DNS propagation takes 5-30 minutes)

### Step 10: Configure Nginx

```bash
# Create Nginx config file
sudo nano /etc/nginx/sites-available/myfng

# Paste this configuration:
server {
    listen 80;
    listen [::]:80;
    server_name myfng.cloud www.myfng.cloud;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Save: Ctrl+X, then Y, then Enter

# Enable the site
sudo ln -s /etc/nginx/sites-available/myfng /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🎯 PART 4: Setup SSL (HTTPS)

### Step 11: Install SSL Certificate (Free - Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d myfng.cloud -d www.myfng.cloud

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose: Redirect HTTP to HTTPS (option 2)

# Certbot will auto-renew. Test renewal:
sudo certbot renew --dry-run
```

---

## 🎯 PART 5: Verify Deployment

### Step 12: Test Application

1. **Wait 10-15 minutes** for DNS propagation
2. Open browser and go to: **https://myfng.cloud**
3. You should see your application!
4. Test login with Super Admin/Lead Manager credentials
5. Check if 400 errors are gone

### Step 13: Monitor Application

```bash
# View PM2 status
pm2 status

# View real-time logs
pm2 logs myfng-web --lines 100

# Restart app if needed
pm2 restart myfng-web

# Stop app
pm2 stop myfng-web

# Delete app from PM2
pm2 delete myfng-web
```

---

## 🔧 TROUBLESHOOTING

### Issue 1: Application Not Starting
```bash
# Check logs
pm2 logs myfng-web

# Check if port 3000 is in use
sudo netstat -tuln | grep 3000

# Kill process on port 3000
sudo kill -9 $(lsof -t -i:3000)

# Restart
pm2 restart myfng-web
```

### Issue 2: Nginx Error
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Issue 3: Domain Not Resolving
```bash
# Check DNS propagation
ping myfng.cloud

# If not resolving, wait 30 minutes for DNS propagation
# Or flush local DNS: (on Mac)
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### Issue 4: SSL Certificate Error
```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## 📊 USEFUL COMMANDS

```bash
# PM2 Commands
pm2 list                    # List all apps
pm2 restart myfng-web       # Restart app
pm2 logs myfng-web          # View logs
pm2 monit                   # Monitor resources
pm2 save                    # Save current process list
pm2 delete myfng-web        # Remove from PM2

# Nginx Commands
sudo systemctl status nginx  # Check Nginx status
sudo systemctl restart nginx # Restart Nginx
sudo nginx -t               # Test config
sudo tail -f /var/log/nginx/access.log  # Access logs
sudo tail -f /var/log/nginx/error.log   # Error logs

# System Monitoring
htop                        # Interactive process viewer
df -h                       # Disk usage
free -m                     # Memory usage
```

---

## 🎉 SUCCESS CHECKLIST

- ✅ VPS setup complete
- ✅ Node.js & PM2 installed
- ✅ Application uploaded and built
- ✅ PM2 running application
- ✅ Nginx configured as reverse proxy
- ✅ Domain pointing to VPS
- ✅ SSL certificate installed
- ✅ Application accessible at https://myfng.cloud
- ✅ Login working
- ✅ No 400 errors!

---

## 🔄 FUTURE UPDATES

When you need to update the application:

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Navigate to project
cd /var/www/myfng/apps/web

# Pull latest changes (if using Git)
git pull origin main

# Or upload new files via SCP/SFTP

# Rebuild
npm install
npm run build

# Restart PM2
pm2 restart myfng-web

# Clear Nginx cache (if needed)
sudo systemctl reload nginx
```

---

## 📞 SUPPORT

If any step fails, check:
1. PM2 logs: `pm2 logs myfng-web`
2. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. System logs: `sudo journalctl -xe`

**Happy Deploying! 🚀**

