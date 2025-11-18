# 🔧 Network Error Fix - Expo Go Connection

## ❌ Current Error:

```
Uncaught Error: java.net.UnknownHostException: 
Unable to resolve host 'zn4dm8q-anonymous-8081.exp.direct': 
No address associated with hostname
```

## 🎯 Problem:

**Tunnel mode** not working properly. Android emulator can't resolve tunnel hostname.

---

## ✅ **SOLUTION 1: Use LAN Mode (Best)**

### **Step 1: Stop Current Server**
```bash
# Terminal me Ctrl+C press karo
# Ya new terminal me:
pkill -f expo
```

### **Step 2: Start with LAN Mode**
```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start --lan
```

### **Step 3: Connect**
Terminal me **local IP** wala URL dikhega:
```
exp://192.168.1.5:8081
```

Expo Go me **ye URL paste karo** (not tunnel URL)

---

## ✅ **SOLUTION 2: Use Localhost Mode**

Agar LAN bhi nahi work kar raha:

### **Step 1: Start with Localhost**
```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start --localhost
```

### **Step 2: Use Special Android IP**
Terminal me URL dikhega but wo Mac ke liye hai.

**Android emulator ke liye special IP use karo:**
```
exp://10.0.2.2:8081
```

### **Step 3: Manually Enter in Expo Go**
1. Expo Go app kholo
2. "Enter URL manually" tap karo
3. Type: `exp://10.0.2.2:8081`
4. Connect!

**Why 10.0.2.2?**
- Android emulator ka special IP
- Points to Mac's localhost
- Always works for emulator

---

## ✅ **SOLUTION 3: Press 'a' in Terminal**

Agar server already chal raha hai:

### **Step 1: Terminal Me 'a' Press Karo**
```
› Press a │ open Android
```

Press **'a'** key

### **Step 2: Expo Will Auto-Deploy**
Expo automatically app ko emulator me open karega!

---

## 📊 **Connection Modes Comparison:**

| Mode | Command | Works With Emulator? | Speed |
|------|---------|---------------------|-------|
| Tunnel | `--tunnel` | ❌ Sometimes fails | Slow |
| LAN | `--lan` | ✅ Best option | Fast |
| Localhost | `--localhost` | ✅ Use 10.0.2.2 | Fastest |

---

## 🎯 **Recommended Steps (In Order):**

### **TRY 1: LAN Mode**
```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start --lan
```
Wait for QR, scan in Expo Go

### **TRY 2: Press 'a' Key**
```bash
# Terminal me server running hai
# Press: a
```

### **TRY 3: Localhost with Special IP**
```bash
npx expo start --localhost
```
Expo Go me manually: `exp://10.0.2.2:8081`

### **TRY 4: Clear Cache**
```bash
npx expo start --clear --lan
```

---

## 🔍 **How to Check Mac's IP:**

Terminal me run karo:
```bash
ipconfig getifaddr en0
```

Output example: `192.168.1.5`

Then URL hoga: `exp://192.168.1.5:8081`

---

## ⚡ **Quick Fix Commands:**

### **Stop Everything:**
```bash
pkill -f expo
pkill -f metro
```

### **Clean Start:**
```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
rm -rf .expo
npx expo start --clear --lan
```

### **Check if Server Running:**
```bash
lsof -i :8081
```

---

## 📱 **What to Do in Expo Go:**

### **Option A: Scan QR (If LAN mode)**
- Works when both on same WiFi
- Fast and easy

### **Option B: Manual URL**
- Click "Enter URL manually"
- Type: `exp://YOUR_MAC_IP:8081`
- Or: `exp://10.0.2.2:8081` (for localhost)

### **Option C: Wait for 'a' Press**
- Terminal me 'a' press karo
- Auto-opens in emulator

---

## 🎨 **Expected Flow:**

```
1. Terminal: npx expo start --lan
2. Wait: "Metro waiting on exp://192.168.x.x:8081"
3. Terminal: Press 'a' key
4. OR
3. Expo Go: Scan QR / Enter URL
4. Result: Orange screen! ✅
```

---

## 🚨 **Common Issues:**

### **Issue: "Network request failed"**
**Solution:** Mac aur emulator same WiFi pe nahi hai
- Check WiFi connection
- Use localhost mode instead

### **Issue: "Could not connect to development server"**
**Solution:** Port 8081 blocked hai
```bash
# Kill process on 8081:
lsof -ti:8081 | xargs kill -9
# Restart Expo
```

### **Issue: "Unable to resolve host"**
**Solution:** Don't use tunnel, use LAN
```bash
npx expo start --lan  # NOT --tunnel
```

---

## ✅ **Current Fix Applied:**

1. ✅ Created `.env` file with proper settings
2. ✅ Stopped all tunnel processes
3. ✅ Ready for LAN mode

---

## 🚀 **NEXT STEP - DO THIS NOW:**

```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start --lan
```

**Then in terminal: Press 'a'**

Or

**Scan QR code in Expo Go**

---

**LAN mode will work! Tunnel mode has network issues!** ✨

