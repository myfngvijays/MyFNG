# 📱 MyFNG Android App Build Guide

## 🎯 Overview

MyFNG ka Android app **web jaisa hi** dikhega, with same features:
- ✅ Role-based dashboards (7 roles)
- ✅ User management
- ✅ Workshop staff management
- ✅ Supabase integration
- ✅ Real-time data

---

## 🚀 Quick Start

### **Prerequisites:**

1. **Node.js 18+** installed
2. **Android Studio** (for Android builds)
3. **Expo Go App** (for testing on phone)

### **Setup Commands:**

```bash
# 1. Navigate to mobile folder
cd /Users/roadserve/Downloads/MyFNG/apps/mobile

# 2. Install dependencies
npm install

# 3. Start development server
npm start

# 4. Scan QR code with Expo Go app on your phone
```

---

## 📱 Testing on Your Phone (Easiest)

### **Step 1: Install Expo Go**
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent
- iOS: https://apps.apple.com/app/expo-go/id982107779

### **Step 2: Start App**
```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npm start
```

### **Step 3: Scan QR Code**
- Expo Go app me "Scan QR code" option pe click karo
- Terminal me dikha QR code scan karo
- App automatically phone pe khul jayega!

---

## 🏗️ Build Android APK

### **Option 1: Using EAS Build (Recommended)**

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Configure project
eas build:configure

# 4. Build APK
eas build --platform android --profile preview
```

APK download link milega email pe!

### **Option 2: Local Build (Advanced)**

```bash
# 1. Install Android Studio
# 2. Setup Android SDK
# 3. Build locally
npx expo prebuild
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

---

## 📦 Build AAB (For Play Store)

```bash
# Build AAB for Google Play Store
eas build --platform android --profile production
```

---

## 🎨 Current Features

### **✅ Already Implemented:**
- Login screen with Supabase auth
- Basic dashboard navigation
- Lead management screens
- Profile screen
- Settings screen

### **🔄 Need to Add (Web Jaisa):**
- Super Admin dashboard
- Workshop Admin dashboard
- Workshop staff management
- Lead Manager dashboard
- Workshop Mechanic dashboard
- Workshop Pickup Boy dashboard
- Customer dashboard
- User management screens
- Password reset functionality

---

## 📂 App Structure

```
apps/mobile/
├── App.tsx                 - Main entry point
├── app.json               - Expo configuration
├── package.json           - Dependencies
├── src/
│   ├── components/        - Reusable components
│   │   ├── LeadCard.tsx
│   │   └── StatCard.tsx
│   ├── screens/          - All screens
│   │   ├── LoginScreen.tsx
│   │   └── dashboard/
│   │       ├── HomeScreen.tsx
│   │       ├── LeadsScreen.tsx
│   │       └── ProfileScreen.tsx
│   ├── navigation/       - Navigation setup
│   │   └── DashboardNavigator.tsx
│   ├── lib/             - Libraries
│   │   └── supabase.ts  - Supabase client
│   ├── store/           - State management
│   │   └── authStore.ts
│   └── constants/       - Colors, themes
│       └── theme.ts
```

---

## 🔧 Environment Setup

### **Create `.env` file:**

```bash
# In apps/mobile/ folder
cat > .env << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://cffommijlvicfjhbqyzk.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U
EOF
```

---

## 📱 App Configuration

### **Update `app.json`:**

```json
{
  "expo": {
    "name": "MyFNG",
    "slug": "myfng",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "package": "ai.astric.myfng",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

---

## 🎯 Next Steps

### **Phase 1: Complete All Screens**
- [ ] Create all 7 role-based dashboard screens
- [ ] Add navigation between screens
- [ ] Implement role-based routing

### **Phase 2: Add Features**
- [ ] User management (Super Admin)
- [ ] Workshop staff management (Workshop Admin)
- [ ] Lead management (All roles)
- [ ] Password reset functionality

### **Phase 3: Polish**
- [ ] Add loading states
- [ ] Error handling
- [ ] Offline support
- [ ] Push notifications

### **Phase 4: Build & Deploy**
- [ ] Test on real devices
- [ ] Build APK
- [ ] Upload to Play Store

---

## 🔨 Development Commands

```bash
# Start development server
npm start

# Run on Android emulator
npm run android

# Run on iOS simulator
npm run ios

# Clear cache
expo start -c

# Update dependencies
npm install

# Build preview
eas build --platform android --profile preview

# Build production
eas build --platform android --profile production
```

---

## 📊 Build Process Timeline

| Step | Time | Description |
|------|------|-------------|
| Setup | 10 min | Install dependencies |
| Development | 2-3 days | Build all screens |
| Testing | 1 day | Test on devices |
| Build APK | 30 min | Generate APK |
| Play Store | 2-7 days | Google review |

---

## 🎨 Design Guidelines

App **web jaisa** dikhega with:
- Same color scheme (MyFNG brand colors)
- Same layout structure
- Same navigation flow
- Same features
- Mobile-optimized UI

---

## 📞 Support Resources

- **Expo Docs:** https://docs.expo.dev/
- **React Native:** https://reactnative.dev/
- **React Navigation:** https://reactnavigation.org/
- **Supabase Mobile:** https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native

---

## ✅ Ready to Build!

**Start karne ke liye:**

```bash
cd /Users/roadserve/Downloads/MyFNG/apps/mobile
npm install
npm start
```

Phone pe Expo Go app se QR code scan karo aur app chal jayega! 🚀

---

**Created:** November 17, 2025  
**Platform:** React Native + Expo  
**Target:** Android (iOS bhi support karega)  
**Status:** Ready for development

