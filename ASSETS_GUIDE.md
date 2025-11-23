# 📁 MyFNG Assets Guide

## 🎨 Brand Assets Location

### 1. **Main Assets Folder** (Shared between Web & Mobile)
```
MyFNG/shared/assets/
├── images/
│   ├── MY-FNG-final-logo-01.png   ← Main Logo (White BG)
│   ├── MY-FNG-final-logo-02.png   ← Alternate Logo (Dark BG)
│   └── ajax-loading.gif            ← Loading Spinner
└── icons/
    ├── favicon.ico                 ← Website Favicon
    ├── favicon-32x32.png           ← 32x32 Favicon
    └── ms-icon-70x70.png           ← Microsoft Tile Icon
```

## 📱 How to Use Assets

### **For Web Application:**

1. **Copy logos to public folder:**
```bash
# From MyFNG root directory
cp shared/assets/images/MY-FNG-final-logo-01.png apps/web/public/logo.png
cp shared/assets/icons/favicon.ico apps/web/public/favicon.ico
```

2. **Use in React components:**
```tsx
// In any component
import Image from 'next/image';

<Image 
  src="/logo.png" 
  alt="MyFNG Logo" 
  width={200} 
  height={50} 
/>
```

3. **Update HTML meta tags:**
```html
<!-- In apps/web/src/app/layout.tsx -->
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/logo-192.png" />
```

---

### **For Mobile Application:**

1. **Copy logos to assets folder:**
```bash
# From MyFNG root directory
cp shared/assets/images/MY-FNG-final-logo-01.png apps/mobile/assets/images/logo.png
```

2. **Update app.json:**
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png"
    }
  }
}
```

3. **Use in React Native components:**
```tsx
import { Image } from 'react-native';

<Image 
  source={require('../../assets/images/logo.png')} 
  style={{ width: 200, height: 50 }}
  resizeMode="contain"
/>
```

---

## 🔄 Asset Setup Commands

### **Quick Setup:**
```bash
# Navigate to project root
cd /Users/roadserve/Downloads/MyFNG

# Copy your downloaded assets to shared folder
# 1. Copy logo files
cp ~/Downloads/MY-FNG-final-logo-01.png shared/assets/images/
cp ~/Downloads/MY-FNG-final-logo-02.png shared/assets/images/
cp ~/Downloads/ajax-loading.gif shared/assets/images/

# 2. Copy icon files
cp ~/Downloads/favicon.ico shared/assets/icons/
cp ~/Downloads/favicon-32x32.png shared/assets/icons/
cp ~/Downloads/ms-icon-70x70.png shared/assets/icons/

# 3. Deploy to web
cp shared/assets/images/MY-FNG-final-logo-01.png apps/web/public/logo.png
cp shared/assets/icons/favicon.ico apps/web/public/

# 4. Deploy to mobile
cp shared/assets/images/MY-FNG-final-logo-01.png apps/mobile/assets/images/logo.png
```

---

## 📐 Recommended Asset Sizes

### **Logos:**
- **Main Logo**: 512x128px (4:1 ratio)
- **Square Logo**: 512x512px (for app icons)
- **Favicon**: 32x32px, 16x16px

### **Mobile App Icons:**
- **iOS**: 1024x1024px (app-icon.png)
- **Android**: 512x512px (adaptive-icon.png)
- **Splash Screen**: 1284x2778px (iPhone 12 Pro Max)

### **Web:**
- **Favicon**: 32x32px, 16x16px
- **Apple Touch Icon**: 180x180px
- **OG Image**: 1200x630px (for social sharing)

---

## 🎨 Brand Colors Reference

```javascript
// Primary Colors
PRIMARY: '#0088E8'      // fng blue
SECONDARY: '#023D95'    // my blue

// Background
BACKGROUND: '#F5F7FA'   // Light Grey
WHITE: '#FFFFFF'

// Text
HEADING: '#023D95'      // Dark Blue
BODY: '#3A3F45'         // Body Text

// Interactive
HOVER: '#0367C4'        // Hover State
LINK: '#0088E8'         // Links
```

---

## 📝 Notes:

1. **Always use shared/assets/** as the single source of truth
2. **Never edit assets in apps/web/public or apps/mobile/assets** directly
3. **Use copy commands** to sync from shared folder
4. **Keep original high-res files** in shared/assets/
5. **Optimize images** before deploying (use ImageOptim, TinyPNG, etc.)

---

## ✅ Checklist:

- [ ] Copy all assets to `shared/assets/`
- [ ] Sync logos to web `public/` folder
- [ ] Sync logos to mobile `assets/` folder
- [ ] Update `app.json` with correct icon paths
- [ ] Update web `layout.tsx` with favicon links
- [ ] Test logos display correctly on both platforms
- [ ] Commit assets to Git (if < 1MB each)

---

**For any questions, refer to this guide or check the brand guidelines document.**

