# MyFNG Troubleshooting Guide

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module 'caniuse-lite'" (Web App)

**Problem:** Next.js dependencies not properly installed.

**Solution:**
```bash
cd /Users/roadserve/Downloads/MyFNG
bash fix-and-start-web.sh
```

**Manual Fix:**
```bash
cd apps/web
rm -rf node_modules .next package-lock.json
npm install --legacy-peer-deps
npm install caniuse-lite browserslist --legacy-peer-deps
npm run dev
```

---

### Issue 2: "Cannot find module '../helpers/bytesAsFloat32'" (Mobile App)

**Problem:** Expo/React Native dependencies conflict.

**Solution:**
```bash
cd /Users/roadserve/Downloads/MyFNG
bash fix-and-start-mobile.sh
```

**Manual Fix:**
```bash
# Clean root node_modules first!
cd /Users/roadserve/Downloads/MyFNG
rm -rf node_modules

# Then install mobile
cd apps/mobile
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npx expo start --clear
```

---

### Issue 3: npm EPERM errors

**Problem:** npm permission issues with global modules.

**Solutions:**

**Option 1: Use --legacy-peer-deps**
```bash
npm install --legacy-peer-deps
```

**Option 2: Use Yarn instead**
```bash
npm install -g yarn
yarn install
yarn dev  # for web
yarn start  # for mobile
```

**Option 3: Fix npm permissions**
```bash
sudo chown -R $USER ~/.npm
npm cache clean --force
```

---

### Issue 4: Workspace conflicts

**Problem:** Root `node_modules` conflicting with app folders.

**Solution:** Always clean root first!
```bash
cd /Users/roadserve/Downloads/MyFNG
rm -rf node_modules package-lock.json
cd apps/web  # or apps/mobile
npm install
```

---

### Issue 5: "Unable to find expo in this project"

**Problem:** Running commands from wrong folder.

**Solution:** Make sure you're in the right folder!
```bash
# WRONG - Don't run from root
cd /Users/roadserve/Downloads/MyFNG
npx expo start  # ❌

# CORRECT - Run from mobile folder
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start  # ✅
```

---

### Issue 6: Port 3000 already in use

**Problem:** Another app using port 3000.

**Solution 1: Kill the process**
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Solution 2: Use different port**
```bash
PORT=3001 npm run dev
```

---

### Issue 7: Next.js build errors

**Problem:** Cached build files causing issues.

**Solution:**
```bash
cd apps/web
rm -rf .next
npm run dev
```

---

### Issue 8: Expo cache issues

**Problem:** Metro bundler cache corruption.

**Solution:**
```bash
cd apps/mobile
npx expo start --clear
# or
rm -rf node_modules/.cache
npx expo start
```

---

## 🎯 Complete Fresh Start

If nothing works, do a complete clean install:

```bash
cd /Users/roadserve/Downloads/MyFNG

# Clean EVERYTHING
rm -rf node_modules package-lock.json
rm -rf apps/web/node_modules apps/web/.next apps/web/package-lock.json
rm -rf apps/mobile/node_modules apps/mobile/package-lock.json

# Install web app
cd apps/web
npm install --legacy-peer-deps
npm run dev

# OR install mobile app (in new terminal)
cd apps/mobile
npm install --legacy-peer-deps
npx expo start --clear
```

---

## 📞 Still Having Issues?

### Check These:

1. **Node Version:**
   ```bash
   node --version  # Should be 18+
   ```

2. **npm Version:**
   ```bash
   npm --version  # Should be 8+
   ```

3. **Folder Location:**
   ```bash
   pwd  # Should be in apps/web or apps/mobile
   ```

4. **Environment File:**
   ```bash
   # Web
   cat apps/web/.env.local
   
   # Mobile
   cat apps/mobile/.env
   ```

---

## 🚀 Recommended: Use Fix Scripts

We created automated fix scripts:

**For Web:**
```bash
cd /Users/roadserve/Downloads/MyFNG
bash fix-and-start-web.sh
```

**For Mobile:**
```bash
cd /Users/roadserve/Downloads/MyFNG
bash fix-and-start-mobile.sh
```

These scripts will:
- ✅ Clean all old files
- ✅ Install dependencies properly
- ✅ Fix missing modules
- ✅ Start the app

---

## 💡 Pro Tips

1. **Always clean root `node_modules` first** before installing app dependencies
2. **Use `--legacy-peer-deps`** flag when installing
3. **Run from correct folder** (apps/web or apps/mobile, not root)
4. **Clear cache** when things don't work (`.next` or expo cache)
5. **Check environment files** are created with correct variables

---

**Happy Coding! 🎉**

