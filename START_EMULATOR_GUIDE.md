# 📱 Start MyFNG on Pixel 7 Emulator

## ✅ Dependencies Installed!

Your mobile app is ready to run on Android emulator!

---

## 🚀 Quick Start Commands

### **Option 1: Start Emulator First (Recommended)**

```bash
# Step 1: Open Android Studio
# - Tools → Device Manager
# - Select Pixel 7 (or create if not exists)
# - Click ▶️ Play button to start

# Step 2: In Terminal, start app
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start --android
```

---

### **Option 2: Single Command (Auto-start)**

```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start --android
```

This will:
- Start Expo dev server
- Automatically launch Android emulator
- Install app on emulator
- Open MyFNG app

---

## 📱 Create Pixel 7 Emulator (If Not Exists)

### **In Android Studio:**

1. **Tools → Device Manager**
2. Click **"Create Device"**
3. Select **"Pixel 7"**
4. Click **"Next"**
5. Download **API 33** (Android 13) if needed
6. Click **"Next"**
7. Name it: `Pixel_7_API_33`
8. Click **"Finish"**

---

## 🎯 Current Status

✅ Dependencies installed (1005 packages)  
✅ Expo configured  
✅ Supabase integrated  
✅ Environment setup  
⏳ Ready to start!  

---

## 🔧 Commands Reference

### **Start Development Server:**
```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start
```

### **Start on Android Emulator:**
```bash
npx expo start --android
```

### **Start on Physical Device:**
```bash
npx expo start
# Scan QR code with Expo Go app
```

### **Clear Cache & Restart:**
```bash
npx expo start -c --android
```

---

## 📊 What You'll See

### **In Terminal:**
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android)

› Press a │ open Android
› Press r │ reload app
› Press m │ toggle menu
› Press c │ clear cache
```

### **On Emulator:**
- App will automatically open
- MyFNG splash screen
- Login page
- Test with Supabase credentials!

---

## 🧪 Testing on Emulator

### **Login Credentials:**
Use any user from your Supabase `users_login` table

### **Test Features:**
- ✅ Login authentication
- ✅ Dashboard loading
- ✅ Role-based navigation
- ✅ Database fetch
- ✅ Real-time updates
- ✅ Camera (emulator camera)
- ✅ Location (mock location)

---

## 🔍 Troubleshooting

### **Emulator Not Starting:**
```bash
# Check if adb is running
adb devices

# Restart adb
adb kill-server
adb start-server

# Try again
npx expo start --android
```

### **App Not Installing:**
```bash
# Clear cache
npx expo start -c --android

# Or manually
adb uninstall com.myfng.app
npx expo start --android
```

### **"expo: command not found":**
```bash
npm install -g expo-cli
# Or use npx
npx expo start --android
```

### **Port Already in Use:**
```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9
npx expo start --android
```

---

## 📱 Emulator Keyboard Shortcuts

- **Cmd + M** - Open developer menu
- **Cmd + R** - Reload app
- **Cmd + D** - Open debug menu
- **Cmd + Shift + Z** - Shake gesture (for menu)

---

## 🎨 Development Tips

### **Hot Reload:**
- Edit files in `src/`
- Changes appear instantly
- No need to rebuild

### **Debug:**
- Press **Cmd + M** on emulator
- Select "Debug"
- Chrome DevTools opens

### **Logs:**
```bash
# View all logs
npx expo start --android

# In separate terminal
npx react-native log-android
```

---

## 📦 What's Running

**Process:** Expo Dev Server  
**Port:** 8081  
**Metro Bundler:** JavaScript bundler  
**Hot Reload:** Enabled  
**Fast Refresh:** Enabled  

---

## ✅ Verification Checklist

After app starts:
- [ ] Emulator opens
- [ ] App installs automatically
- [ ] MyFNG logo appears
- [ ] Login page loads
- [ ] Can login with Supabase
- [ ] Dashboard appears
- [ ] Data loads from database

---

## 🚀 Quick Commands Summary

```bash
# Basic start
npx expo start --android

# Clear cache
npx expo start -c --android

# Production mode
npx expo start --android --no-dev

# Specific emulator
npx expo start --android --device Pixel_7_API_33
```

---

## 📞 Need Help?

### **Common Issues:**
1. **Emulator slow?** 
   - Increase RAM in AVD settings (4GB+)
   - Enable hardware acceleration
   
2. **App crashes?**
   - Check terminal for errors
   - Clear cache and restart
   
3. **Can't connect to Supabase?**
   - Check environment config
   - Verify internet on emulator

---

## 🎊 You're All Set!

App is starting on Pixel 7 emulator! 

Check your Android Studio window for the emulator! 📱

---

**Location:** `/Users/roadserve/Downloads/MyFNG/apps/mobile`  
**Command:** `npx expo start --android`  
**Emulator:** Pixel 7  
**Status:** 🟢 Running  

