# 🚀 GIT COMMIT & DEPLOYMENT GUIDE

## Live Server पर Update करने से पहले क्या करें

---

## ✅ STEP 1: GIT पर क्या-क्या Commit करें

### 📁 जरूरी Files (MUST COMMIT):

#### 1️⃣ Database Files
```bash
database/FINAL_COMPLETE_MIGRATION.sql           # Main migration
database/VERIFICATION_QUERIES.sql               # Verification
database/DETAILED_VERIFICATION.sql              # Detailed check
database/STEP_BY_STEP_VERIFICATION.md          # Documentation
database/CURRENT_SCHEMA_ANALYSIS.md            # Analysis
```

#### 2️⃣ TypeScript Types
```bash
shared/types/lead-flow.ts                       # New type definitions
```

#### 3️⃣ API Endpoints (4 files)
```bash
apps/web/src/app/api/lead-manager/validate-lead/route.ts
apps/web/src/app/api/lead-manager/assign-workshop/route.ts
apps/web/src/app/api/lead-manager/pending-leads/route.ts
apps/web/src/app/api/lead-manager/available-workshops/route.ts
```

#### 4️⃣ UI Components (2 files)
```bash
apps/web/src/app/dashboard/lead_manager/page.tsx
apps/web/src/app/dashboard/lead_manager/leads/[id]/page.tsx
```

#### 5️⃣ Documentation Files
```bash
LEAD_FLOW_IMPLEMENTATION_COMPLETE.md
COMPLETE_LEAD_FLOW_READY.md
GIT_COMMIT_DEPLOYMENT_GUIDE.md                 # This file
```

---

## ❌ GIT पर क्या-क्या COMMIT NAHI करें

### 🚫 Never Commit These:

```bash
# Environment files
.env
.env.local
.env.production
ENV_PRODUCTION_CONTENT.txt

# Dependencies
node_modules/
.next/
dist/
build/

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/

# Temporary files
*.tmp
*.temp
*.swp

# Zip/Archive files
*.zip
*.tar.gz
hostinger-deployment.zip
myfng-deployment.zip
```

---

## 📝 STEP 2: Git Commands (Run These)

### 1️⃣ Check Current Status
```bash
cd /Users/roadserve/Downloads/MyFNG
git status
```

### 2️⃣ Add Only Important Files

**Option A: Add Specific Files (RECOMMENDED)**
```bash
# Database files
git add database/FINAL_COMPLETE_MIGRATION.sql
git add database/VERIFICATION_QUERIES.sql
git add database/DETAILED_VERIFICATION.sql
git add database/STEP_BY_STEP_VERIFICATION.md
git add database/CURRENT_SCHEMA_ANALYSIS.md

# Types
git add shared/types/lead-flow.ts

# API files
git add apps/web/src/app/api/lead-manager/

# UI files
git add apps/web/src/app/dashboard/lead_manager/

# Documentation
git add LEAD_FLOW_IMPLEMENTATION_COMPLETE.md
git add COMPLETE_LEAD_FLOW_READY.md
git add GIT_COMMIT_DEPLOYMENT_GUIDE.md
```

**Option B: Add All Changes (BE CAREFUL)**
```bash
# First review what will be added
git status

# If everything looks good
git add .
```

### 3️⃣ Commit with Good Message
```bash
git commit -m "✨ Implement complete 12-step Lead Flow with Lead Manager

Features:
- ✅ Added 24 new columns to service_leads table
- ✅ Added 10 new lead status values
- ✅ Created 5 new tables (CSE, complaints, billing, metrics, history)
- ✅ Implemented Lead Manager validation API
- ✅ Implemented workshop assignment API
- ✅ Created Lead Manager dashboard UI
- ✅ Complete TypeScript types for new features

Database Migration: FINAL_COMPLETE_MIGRATION.sql
API Endpoints: 4 new endpoints
UI Components: Lead Manager dashboard + review page
"
```

### 4️⃣ Push to GitHub/Remote
```bash
# If first time
git push -u origin main

# If already configured
git push
```

---

## 🔄 STEP 3: Live Server पर Deployment

### Option A: Using Git on Server (RECOMMENDED)

#### 1️⃣ SSH into your server
```bash
ssh your-user@your-server-ip
```

#### 2️⃣ Navigate to project directory
```bash
cd /path/to/your/project/MyFNG
```

#### 3️⃣ Pull latest changes
```bash
git pull origin main
```

#### 4️⃣ Install dependencies (if package.json changed)
```bash
npm install
```

#### 5️⃣ Run Database Migration
```bash
# Option 1: Using Supabase CLI
supabase db push database/FINAL_COMPLETE_MIGRATION.sql

# Option 2: Copy SQL and run in Supabase Dashboard
# Copy content of FINAL_COMPLETE_MIGRATION.sql
# Paste in Supabase SQL Editor and Run
```

#### 6️⃣ Build the application
```bash
# For web app
cd apps/web
npm run build

# For mobile app (if needed)
cd apps/mobile
npm run build
```

#### 7️⃣ Restart the server
```bash
# If using PM2
pm2 restart all

# If using systemd
sudo systemctl restart your-app-name

# If using Docker
docker-compose restart
```

---

### Option B: Manual Upload (NOT RECOMMENDED)

Only use this if you don't have git on server:

1. Create a zip of necessary files (excluding node_modules, .env, etc.)
2. Upload to server via FTP/SFTP
3. Extract on server
4. Run npm install
5. Run database migration
6. Build and restart

---

## ⚠️ IMPORTANT: Before Deployment

### 1️⃣ Backup Current Database
```sql
-- In Supabase Dashboard, go to:
-- Settings > Database > Create Backup
-- OR use SQL:
-- pg_dump your_database > backup_$(date +%Y%m%d).sql
```

### 2️⃣ Test Migration Locally First
```bash
# Make sure migration runs without errors
# Check in your local Supabase instance first
```

### 3️⃣ Update .env on Server
```bash
# Make sure these are set on server:
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### 4️⃣ Check Dependencies
```bash
# Make sure all packages are compatible
npm audit
npm outdated
```

---

## 🔍 STEP 4: Post-Deployment Verification

### 1️⃣ Database Verification
```bash
# Run verification queries
# Use VERIFICATION_QUERIES.sql or DETAILED_VERIFICATION.sql
```

### 2️⃣ API Testing
```bash
# Test each endpoint:
curl -X POST https://your-domain.com/api/lead-manager/validate-lead \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "test-id", "is_valid": true}'
```

### 3️⃣ UI Testing
```bash
# Open browser and test:
https://your-domain.com/dashboard/lead_manager
```

### 4️⃣ Check Logs
```bash
# Check server logs for errors
pm2 logs
# or
tail -f /var/log/your-app/error.log
```

---

## 🎯 DEPLOYMENT CHECKLIST

- [ ] ✅ Database backup taken
- [ ] ✅ All important files committed to git
- [ ] ✅ .env files excluded from git
- [ ] ✅ node_modules excluded from git
- [ ] ✅ Changes pushed to GitHub
- [ ] ✅ SSH into server successful
- [ ] ✅ Git pull completed
- [ ] ✅ Dependencies installed (npm install)
- [ ] ✅ Database migration run successfully
- [ ] ✅ Build completed without errors
- [ ] ✅ Server restarted
- [ ] ✅ Verification queries run
- [ ] ✅ API endpoints tested
- [ ] ✅ UI pages tested
- [ ] ✅ No errors in logs

---

## 🚨 ROLLBACK PLAN (If Something Goes Wrong)

### 1️⃣ Rollback Database
```sql
-- Restore from backup
-- In Supabase Dashboard: Settings > Database > Restore
```

### 2️⃣ Rollback Code
```bash
# On server
git log --oneline  # Find previous commit
git reset --hard <previous-commit-hash>
npm install
npm run build
pm2 restart all
```

---

## 📞 QUICK COMMANDS SUMMARY

```bash
# === LOCAL (Your Computer) ===
cd /Users/roadserve/Downloads/MyFNG
git status
git add database/ shared/ apps/web/src/app/api/lead-manager/ apps/web/src/app/dashboard/lead_manager/
git add *.md
git commit -m "✨ Implement complete 12-step Lead Flow"
git push origin main

# === SERVER ===
ssh your-user@your-server
cd /path/to/MyFNG
git pull origin main
npm install
# Run database migration in Supabase Dashboard
cd apps/web && npm run build
pm2 restart all

# === VERIFY ===
# Open https://your-domain.com/dashboard/lead_manager
# Test the new features
```

---

## 🎊 Done!

Your complete Lead Flow implementation is now live! 🚀

**Questions?** Check logs or run verification queries.

