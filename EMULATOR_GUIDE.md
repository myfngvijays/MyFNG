# 🚀 Emulator Pe App Run Karne Ka Complete Guide

## Quick Start (Sabse Aasan Tarika)

### Option 1: Automatic Script (Recommended)
```bash
./start-emulator.sh
```

### Option 2: Manual Commands
```bash
cd apps/mobile
npx expo start --android
```

---

## 📱 Step by Step Instructions

### 1️⃣ Android Emulator Start Karo

**Agar Android Studio Install Hai:**
- Android Studio kholo
- Tools → Device Manager
- Koi bhi emulator select karo aur play button dabao
- Wait karo jab tak emulator puri tarah load na ho jaye

**Agar Android Studio Nahi Hai:**
```bash
# Terminal se emulator start karo
emulator -avd Pixel_5_API_33
```

### 2️⃣ App Start Karo

**Root folder se:**
```bash
./start-emulator.sh
```

**Ya directly mobile folder se:**
```bash
cd apps/mobile
npx expo start --android
```

### 3️⃣ Changes Dekhne Ke Liye

- **Code edit karo** → Automatically reload hoga! 🎉
- **Manual reload:** Emulator me `RR` press karo
- **Dev menu:** Emulator me `Ctrl+M` (Windows) ya `Cmd+M` (Mac)

---

## 🔥 Hot Reload Kaise Kaam Karta Hai?

1. **Expo server chal raha hoga** - Terminal me dekho
2. **Koi bhi .tsx ya .ts file edit karo**
3. **Save karo** (Cmd+S / Ctrl+S)
4. **Automatically emulator me dikhayi dega!** ⚡

### Example:
```typescript
// apps/mobile/src/screens/LoginScreen.tsx me change karo

<Text>Old Text</Text>  →  <Text>New Text</Text>

// Save karo aur emulator me turant dikhayi dega!
```

---

## 🛠️ Common Issues & Solutions

### Issue 1: "No devices found"
**Solution:**
```bash
# Check if emulator is running
adb devices

# If empty, start emulator first
# Open Android Studio → Device Manager → Start emulator
```

### Issue 2: "Port already in use"
**Solution:**
```bash
# Kill existing Expo server
pkill -f expo
# or
lsof -ti:8081 | xargs kill

# Start again
npx expo start --android
```

### Issue 3: "Unable to connect"
**Solution:**
```bash
# Reset Metro bundler cache
cd apps/mobile
npx expo start --clear
```

### Issue 4: Changes dikh nahi rahe
**Solution:**
- Emulator me shake karo (Ctrl+M)
- "Reload" dabao
- Ya `RR` type karo terminal me

---

## ⚡ Pro Tips

### 1. Fast Refresh Enable Karo
- Dev menu kholo (Ctrl+M / Cmd+M)
- "Fast Refresh" enable karo
- Automatic reload hoga!

### 2. Multiple Files Edit Karte Waqt
- Ek file save karo → wait 2-3 seconds
- Next file save karo
- Ya multiple files ek saath save karo

### 3. Logs Dekhne Ke Liye
```bash
# Terminal me logs ayenge
# Ya press 'j' in Expo terminal to open debugger
```

---

## 🎯 Development Workflow

```
┌─────────────────────────────────────┐
│ 1. Start Emulator                   │
│    (Android Studio)                 │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 2. Run: ./start-emulator.sh         │
│    (Terminal)                       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 3. Wait for app to load             │
│    (Emulator me app khul jayegi)    │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 4. Edit code & Save                 │
│    (VS Code / Cursor)               │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ 5. See changes LIVE!                │
│    (Auto reload in 2-3 seconds)     │
└─────────────────────────────────────┘
```

---

## 🚦 Status Check Commands

```bash
# Check if emulator is running
adb devices

# Check Expo server status
lsof -ti:8081

# Check Metro bundler logs
# (Already visible in terminal where expo is running)

# List all running emulators
emulator -list-avds
```

---

## 📞 Keyboard Shortcuts

### In Emulator:
- `Ctrl+M` (Windows) / `Cmd+M` (Mac) - Dev Menu
- `R` twice - Reload App
- `Ctrl+Shift+Z` - Toggle Inspector

### In Expo Terminal:
- `a` - Open on Android
- `i` - Open on iOS (Mac only)
- `w` - Open on Web
- `r` - Reload app
- `m` - Toggle menu
- `j` - Open debugger

---

## ✅ Verification

Emulator pe app sahi se chal raha hai ya nahi, yeh check karo:

1. ✅ Terminal me "Metro bundler started" dikhai de
2. ✅ Emulator me app khul jaye
3. ✅ Koi error na dikhe
4. ✅ Code change karne pe auto reload ho

---

## 🎉 You're All Set!

Ab tum code karo aur emulator me **live changes** dekho!

**Happy Coding! 🚀**

