# 🚀 Quick VPS Deployment Commands

## ⚡ Super Fast Deployment (Using Script)

### Option 1: Automated Script (Recommended)

```bash
# Make script executable
chmod +x deploy-to-vps.sh

# Run deployment (replace with your VPS IP)
./deploy-to-vps.sh YOUR_VPS_IP

# Example:
./deploy-to-vps.sh 123.45.67.89
```

This script will:
- Build your app locally
- Upload to VPS
- Install dependencies
- Start with PM2

---

## 🔧 Manual Deployment Steps

### Step 1: Connect to VPS
```bash
ssh root@YOUR_VPS_IP
```

### Step 2: Initial VPS Setup (First Time Only)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 3: Upload Project (From Your Mac)
```bash
# Open NEW terminal on Mac (not SSH)
cd /Users/roadserve/Downloads/MyFNG

# Build first
cd apps/web
npm install
npm run build
cd ../..

# Upload to VPS
scp -r apps/web/.next root@YOUR_VPS_IP:/var/www/myfng/
scp -r apps/web/public root@YOUR_VPS_IP:/var/www/myfng/
scp apps/web/package*.json root@YOUR_VPS_IP:/var/www/myfng/
scp apps/web/next.config.js root@YOUR_VPS_IP:/var/www/myfng/
```

### Step 4: Setup on VPS (Back to SSH)
```bash
# Navigate to app directory
cd /var/www/myfng

# Install production dependencies
npm install --production

# Create environment file
nano .env.local

# Paste this (update your keys):
NEXT_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_key_here

# Save: Ctrl+X, then Y, then Enter

# Start with PM2
pm2 start npm --name "myfng-web" -- start
pm2 save
pm2 startup
```

### Step 5: Configure Nginx
```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/myfng

# Paste this:
server {
    listen 80;
    server_name myfng.in www.myfng.in;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Keep old domain alive with permanent redirect
server {
    listen 80;
    server_name myfng.cloud www.myfng.cloud;
    return 301 https://myfng.in$request_uri;
}

# Save: Ctrl+X, then Y, then Enter

# Enable site
sudo ln -s /etc/nginx/sites-available/myfng /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Setup SSL (HTTPS)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate for primary domain
sudo certbot --nginx -d myfng.in -d www.myfng.in

# Optional: keep certificate for old cloud redirect host as well
sudo certbot --nginx -d myfng.cloud -d www.myfng.cloud

# Follow prompts and select "Redirect HTTP to HTTPS"
```

### Step 7: Configure DNS in GoDaddy
1. Go to GoDaddy Dashboard → Domains → myfng.in → DNS
2. Add A Record:
   - Type: A
   - Name: @
   - Value: YOUR_VPS_IP
   - TTL: 3600
3. Add A Record for www:
   - Type: A
   - Name: www
   - Value: YOUR_VPS_IP
   - TTL: 3600
4. Save and wait 10-30 minutes for propagation

---

## 📊 Useful Commands After Deployment

### PM2 Management
```bash
pm2 list                    # Check app status
pm2 logs myfng-web          # View logs
pm2 restart myfng-web       # Restart app
pm2 stop myfng-web          # Stop app
pm2 monit                   # Monitor resources
```

### Nginx Management
```bash
sudo systemctl status nginx  # Check status
sudo systemctl restart nginx # Restart
sudo nginx -t               # Test config
sudo tail -f /var/log/nginx/error.log  # View errors
```

### System Monitoring
```bash
htop                        # System resources
df -h                       # Disk space
free -m                     # Memory usage
pm2 monit                   # App monitoring
```

---

## 🔄 Update Application (Future)

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP
cd /var/www/myfng

# Upload new build from Mac (new terminal)
cd /Users/roadserve/Downloads/MyFNG/apps/web
npm run build
scp -r .next root@YOUR_VPS_IP:/var/www/myfng/

# Back to VPS SSH, restart
pm2 restart myfng-web
```

---

## 🎯 Final Check

After deployment, test these URLs:

1. **http://myfng.in** → Should redirect to HTTPS
2. **https://myfng.in** → Should load homepage
3. **https://myfng.in/login** → Should load login page
4. **https://myfng.cloud/login** → Should 301 redirect to `https://myfng.in/login`
4. **Login as Lead Manager** → Check if 400 errors are gone!

---

## 🚨 Troubleshooting

### App not starting
```bash
pm2 logs myfng-web --lines 50
```

### Port 3000 in use
```bash
sudo netstat -tuln | grep 3000
sudo kill -9 $(lsof -t -i:3000)
pm2 restart myfng-web
```

### Domain not resolving
```bash
ping myfng.in
# If no response, wait 30 mins for DNS propagation
```

### SSL certificate error
```bash
sudo certbot renew
sudo certbot certificates
```

---

## ✅ Success Checklist

- [ ] VPS setup complete (Node.js, PM2, Nginx installed)
- [ ] Application uploaded and built
- [ ] PM2 running application (check with `pm2 list`)
- [ ] Nginx configured
- [ ] DNS records added (A records for @ and www)
- [ ] SSL certificate installed
- [ ] https://myfng.in loads successfully
- [ ] https://myfng.cloud redirects to https://myfng.in
- [ ] Login working
- [ ] No 400 errors in console!

---

**Deployment Complete! Access your app at: https://myfng.in**

