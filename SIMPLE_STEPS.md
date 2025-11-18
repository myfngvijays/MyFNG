# 📱 Simple Steps - Expo Go Me App Chalao

## 🎯 Problem: Terminal me kuch nahi dikh raha

**Solution: Manually terminal me command run karo!**

---

## ✅ **Step-by-Step:**

### **STEP 1: New Terminal Window Kholo** 💻

Mac pe:
- Spotlight search (Cmd + Space)
- Type "Terminal"
- Open karo

Ya:
- Cursor me new terminal

---

### **STEP 2: Ye Command Copy Karo** 📋

```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start --tunnel
```

---

### **STEP 3: Terminal Me Paste Karke Enter Press Karo** ⚡

Kuch seconds me ye dikhega:

```
Starting Metro Bundler

› Metro waiting on exp://192.168.x.x:8081

  ┌─────────────────────────────────┐
  │                                 │
  │  ████████████████████████████   │
  │  ████████████████████████████   │  ← QR CODE
  │  ████████████████████████████   │
  │  ████████████████████████████   │
  │                                 │
  └─────────────────────────────────┘

› Scan the QR code above with Expo Go

› Or enter this URL manually:
  exp://192.168.1.5:8081

› Or tunnel URL:
  exp://u.expo.dev/xxxx-xxxx-xxxx

› Press a │ open Android
› Press r │ reload app
```

---

### **STEP 4: Pixel 7 Me Expo Go Kholo** 📲

1. Expo Go app tap karo
2. Main screen pe 2 buttons honge:
   - **"Scan QR Code"**
   - **"Enter URL manually"**

---

### **STEP 5: Connect Karo** 🔗

**Method A: QR Scan**
- "Scan QR Code" tap karo
- Terminal ka QR code scan karo
- Done!

**Method B: URL**
- "Enter URL manually" tap karo
- Terminal se URL copy karo (exp://...)
- Paste karo
- "Connect" tap karo
- Done!

---

### **STEP 6: App Load Hoga!** 🎉

Orange screen dikhega:
```
MyFNG Mobile
✅ App is Working!
Running on Pixel 7
React Native + Expo
```

---

## 🔧 **If Terminal Shows Error:**

### **Error: "command not found: npx"**
```bash
# Node.js install hai? Check karo:
node --version

# Agar nahi hai, install karo:
brew install node
```

### **Error: "EPERM" or permission error**
```bash
# Sudo se run karo:
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
sudo npx expo start --tunnel
```

### **Error: "Metro bundler error"**
```bash
# Cache clear karke try karo:
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start --clear --tunnel
```

---

## 📋 **Quick Reference:**

| What | Command |
|------|---------|
| **Start Expo** | `cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start --tunnel` |
| **Clear cache** | `npx expo start --clear --tunnel` |
| **Stop Expo** | Press `Ctrl + C` in terminal |
| **Restart** | Stop then start again |

---

## 🎯 **Expected Timeline:**

```
00:00 - Command paste karo
00:05 - "Starting Metro Bundler" dikhega
00:10 - "Bundling..." dikhega
00:20 - QR code dikhega ✅
00:25 - Expo Go se scan karo
00:30 - App load hoga! 🎉
```

---

## ⚡ **Super Quick Version:**

1. **Terminal:** `cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start --tunnel`
2. **Wait:** 20 seconds for QR code
3. **Expo Go:** Scan QR
4. **Done!** 🎉

---

## 📱 **What You'll See:**

### **In Terminal:**
- ✅ Metro Bundler starting
- ✅ QR Code (big square)
- ✅ URLs (exp://...)
- ✅ Options (press a, r, etc)

### **In Expo Go:**
- ✅ Connection screen
- ✅ "Building JavaScript bundle"
- ✅ Orange screen loads
- ✅ "MyFNG Mobile" text

---

## 🚀 **ABHI YE KARO:**

```bash
# Copy this entire line:
cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start --tunnel

# Paste in terminal
# Press Enter
# Wait for QR code
# Scan in Expo Go
```

---

**Simple hai! Bas terminal me command run karo!** ✨

