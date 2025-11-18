# MyFNG - Quick Commands Reference

## 🚀 Start Commands

### Web App:
```bash
# Method 1: Auto-fix script
bash fix-and-start-web.sh

# Method 2: Manual
cd apps/web
npm run dev
# Opens: http://localhost:3000
```

### Mobile App:
```bash
# Method 1: Auto-fix script
bash fix-and-start-mobile.sh

# Method 2: Manual
cd apps/mobile
npm install
npx expo start
# Scan QR code with Expo Go
```

---

## 🔧 Fix Commands

### Fix Web App:
```bash
cd apps/web
rm -rf node_modules .next package-lock.json
npm install --legacy-peer-deps
npm run dev
```

### Fix Mobile App:
```bash
cd apps/mobile
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npx expo start --clear
```

### Fix Environment Variables:
```bash
bash fix-env.sh
```

---

## 📝 Useful Commands

### Check Server:
```bash
lsof -ti:3000  # See what's on port 3000
```

### Kill Server:
```bash
lsof -ti:3000 | xargs kill -9
```

### Clear All Caches:
```bash
cd apps/web
rm -rf node_modules .next package-lock.json
```

### View Environment:
```bash
cat apps/web/.env.local
```

---

## 🗄️ Supabase Commands

### Connect to Database:
- Dashboard: https://app.supabase.com
- Project: cffommijlvicfjhbqyzk
- SQL Editor: Run queries

### Seed Roles:
```sql
-- Run this in Supabase SQL Editor
-- File: database/05_seed_data.sql
```

---

## 📦 Install Commands

### Install Everything:
```bash
# From root
npm install

# Web
cd apps/web && npm install

# Mobile
cd apps/mobile && npm install
```

---

## 🎯 Quick Links

- **Web:** http://localhost:3000
- **Login:** http://localhost:3000/login
- **Supabase:** https://app.supabase.com
- **Expo:** https://expo.dev

---

## 💡 Remember

- **Web uses:** `NEXT_PUBLIC_*`
- **Mobile uses:** `EXPO_PUBLIC_*`
- Always restart server after env changes
- Clear `.next` cache if issues persist

