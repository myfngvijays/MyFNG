# 📱 Manual Steps - Pixel 7 Pe App Chalao

## 🎯 Step-by-Step Instructions

### **Step 1: Android Studio Kholo**
1. Android Studio application open karo
2. **Tools** menu → **Device Manager** click karo
3. **Pixel 7** emulator dhundo list me

---

### **Step 2: Pixel 7 Emulator Start Karo**

**Option A: Agar Pixel 7 List Me Hai**
- Pixel 7 ke samne **▶️ (Play)** button click karo
- Wait karo 1-2 minutes
- Emulator window khulega

**Option B: Agar Pixel 7 Nahi Hai**
1. **Create Device** button click karo
2. **Pixel 7** select karo
3. **Next** click karo
4. **API 33 (Android 13)** select karo
5. **Download** karo agar nahi hai
6. **Next** → **Finish**
7. Ab **▶️ Play** button click karo

---

### **Step 3: Terminal Me Ye Command Run Karo**

New terminal window kholo aur paste karo:

```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start
```

---

### **Step 4: App Install Karo**

Terminal me ye dikhega:
```
› Metro waiting on exp://...
› Press a │ open Android
› Press r │ reload app
```

Ab keyboard pe **`a`** press karo!

---

## 🚀 **Alternative: One Command (Auto-Everything)**

Agar emulator already running hai, to ye single command run karo:

```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile && npx expo start --android
```

Ye automatically:
1. Expo start karega
2. Emulator detect karega
3. App install karega
4. App open karega

---

## 🔍 **Check Karo Emulator Chal Raha Hai Ki Nahi**

Terminal me ye command run karo:

```bash
adb devices
```

**Output:**
```
List of devices attached
emulator-5554    device
```

Agar ye dikha to emulator ready hai! ✅

---

## 📱 **Agar Emulator List Me Nahi Hai:**

### **Quick Create Pixel 7:**

1. Android Studio → Tools → Device Manager
2. Create Device
3. Select **Phone** → **Pixel 7**
4. Next
5. Select **Tiramisu (API 33)**
6. Download agar required ho
7. Next → Finish
8. Play button click karo

---

## ⚡ **Super Quick Method (Video Banane Ke Liye Best):**

```bash
# Terminal 1: Start Expo
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npx expo start

# Terminal 2: Check devices
adb devices

# Terminal 1: Press 'a' for Android
# (keyboard pe 'a' press karo)
```

---

## 🎯 **Current Setup:**

✅ Dependencies installed  
✅ Expo configured  
✅ Supabase connected  
⏳ Emulator start karna hai  
⏳ Press 'a' karna hai  

---

## 🔧 **Troubleshooting:**

### **Error: "No Android devices found"**
```bash
# Emulator start karo pehle Android Studio se
# Phir check karo:
adb devices
```

### **Error: "adb: command not found"**
```bash
# Android Studio ke SDK path add karo:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### **Emulator bahut slow hai:**
- Android Studio → AVD Manager → Edit
- RAM increase karo (4GB+)
- Graphics: Hardware acceleration enable karo

---

## 📊 **What Should Happen:**

1. ✅ Terminal me Metro bundler start hoga
2. ✅ Emulator me app install hoga
3. ✅ MyFNG logo dikhega
4. ✅ Login page khulega
5. ✅ Login karke dashboard dekhoge!

---

## 🎊 **Video Banate Waqt:**

1. Android Studio → Start Pixel 7
2. Terminal → `cd /Users/roadserve/Downloads/MyFNG/apps/mobile`
3. Terminal → `npx expo start`
4. Wait for QR code
5. Press **`a`** for Android
6. App opens on Pixel 7! 🎥

---

**Ab Android Studio kholo aur Pixel 7 start karo! 📱**

