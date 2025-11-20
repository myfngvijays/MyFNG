# 🛠️ Common Errors & Quick Fixes

## Error 1: "main has not been registered"

### ❌ Error Message:
```
ERROR  Invariant Violation: "main" has not been registered. 
This can happen if:
* Metro (the local dev server) is run from the wrong folder.
* A module failed to load due to an error
```

### ✅ Quick Fix:

**Option A: Automatic Script**
```bash
./fix-app-and-restart.sh
```

**Option B: Manual Steps**
```bash
# 1. Stop all processes
pkill -f expo
pkill -f metro

# 2. Clear cache
cd apps/mobile
rm -rf .expo
rm -rf node_modules/.cache

# 3. Start fresh
npx expo start --android --clear
```

---

## Error 2: Permission Denial (Screen Capture)

### ❌ Error Message:
```
ERROR  Error: Exception in HostObject::get for prop 'NativeUnimoduleProxy': 
java.lang.SecurityException: Permission Denial: 
registerScreenCaptureObserver requires android.permission.DETECT_SCREEN_CAPTURE
```

### ✅ Fix:
Yeh error **ignore kar sakte ho** - yeh sirf warning hai. App chalni chahiye.

Agar app nahi chal rahi, to:
1. Emulator **restart** karo
2. App **uninstall** karo emulator se
3. Phir se install karne do

---

## Error 3: Metro Bundler Port Already in Use

### ❌ Error Message:
```
ERROR: Port 8081 already in use
```

### ✅ Fix:
```bash
# Kill the process using port 8081
lsof -ti:8081 | xargs kill

# Or kill all expo/metro processes
pkill -f expo
pkill -f metro

# Then restart
cd apps/mobile
npx expo start --android
```

---

## Error 4: Cannot Connect to Metro

### ❌ Error Message:
```
Unable to connect to Metro
```

### ✅ Fix:

**Step 1: Check Metro is running**
- Terminal me "Metro bundler started" dikhai dena chahiye

**Step 2: Restart Metro**
```bash
# Stop
Ctrl+C in terminal

# Start again
npx expo start --android --clear
```

**Step 3: Emulator me Dev Menu**
- Press `Ctrl+M` (Windows) or `Cmd+M` (Mac)
- "Reload" pe click karo

---

## Error 5: App White Screen / Blank Screen

### ❌ Symptoms:
App khulti hai lekin sirf white screen dikhai deti hai

### ✅ Fix:

**Quick Fix:**
```bash
# In emulator, press:
R + R (double tap R)

# Or shake emulator and select "Reload"
```

**Deep Fix:**
```bash
./fix-app-and-restart.sh
```

---

## Error 6: Module Not Found

### ❌ Error Message:
```
ERROR: Module 'xyz' not found
```

### ✅ Fix:
```bash
cd apps/mobile

# Reinstall dependencies
rm -rf node_modules
npm install

# Clear cache and restart
npx expo start --android --clear
```

---

## Error 7: Emulator Not Detected

### ❌ Error Message:
```
No Android connected device found
```

### ✅ Fix:

**Step 1: Check emulator is running**
```bash
adb devices

# Should show something like:
# emulator-5554    device
```

**Step 2: If empty, start emulator**
- Open Android Studio
- Tools → Device Manager
- Start any emulator

**Step 3: If still not working**
```bash
# Restart ADB
adb kill-server
adb start-server

# Check again
adb devices
```

---

## 🚀 Universal Fix (Try This First!)

Agar koi bhi error aaye, pehle yeh try karo:

```bash
# One command to fix everything!
./fix-app-and-restart.sh
```

**Yeh script automatically:**
1. ✅ Sab processes stop karega
2. ✅ Cache clear karega
3. ✅ Fresh start karega
4. ✅ Emulator pe app load karega

---

## 💡 Pro Tips

### Tip 1: Always Clear Cache on Errors
```bash
npx expo start --clear
```

### Tip 2: Check Logs
Terminal me puri error log dekho - exact problem pata chalega

### Tip 3: Emulator Restart
Sometimes simple emulator restart sabse acha solution hai!

### Tip 4: Fresh Install
Agar kuch bhi kaam na kare:
```bash
cd apps/mobile
rm -rf node_modules
npm install
npx expo start --android --clear
```

---

## 📞 Quick Commands Reference

```bash
# Start app normally
./start-emulator.sh

# Fix errors and restart
./fix-app-and-restart.sh

# Manual start
cd apps/mobile
npx expo start --android

# Clear cache start
npx expo start --android --clear

# Check emulator
adb devices

# Kill all expo processes
pkill -f expo && pkill -f metro
```

---

## ✅ Final Checklist

Agar app nahi chal rahi, check karo:

- [ ] Emulator chal raha hai? (`adb devices`)
- [ ] Metro bundler chal raha hai? (Terminal me dekho)
- [ ] Dependencies install hain? (`node_modules` folder exists)
- [ ] `.env` file me credentials hain?
- [ ] Cache clear kiya? (`--clear` flag use kiya?)
- [ ] Error log dekha? (Terminal me full error message)

---

## 🎉 Ab Toh App Chalegi!

In fixes se 99% errors solve ho jate hain!

**Happy Coding! 💪**

