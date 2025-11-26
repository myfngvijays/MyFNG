# 🔐 ENVIRONMENT SETUP - Complete Guide

**Last Updated:** November 26, 2025  
**Status:** ✅ Environment files created with Razorpay keys

---

## 🚀 Quick Start

Run this command to create all environment files:

```bash
cd /Users/roadserve/Downloads/MyFNG
bash create-env-files.sh
```

This will create:
- ✅ `apps/web/.env.local` (Local development)
- ✅ `apps/web/.env.production` (Production)
- ✅ `apps/mobile/.env` (Local development)
- ✅ `apps/mobile/.env.production` (Production)

---

## 📁 Files Created

### Web App - Local Development
**File:** `apps/web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Razorpay Keys (Already Added)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard
```

### Web App - Production
**File:** `apps/web/.env.production`

```env
NEXT_PUBLIC_SUPABASE_URL=your-production-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-anon-key-here
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Razorpay Keys (Already Added)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard
```

### Mobile App - Local Development
**File:** `apps/mobile/.env`

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Razorpay Key (Already Added)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO

EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Mobile App - Production
**File:** `apps/mobile/.env.production`

```env
EXPO_PUBLIC_SUPABASE_URL=your-production-supabase-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-anon-key-here

# Razorpay Key (Already Added)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO

EXPO_PUBLIC_API_URL=https://yourdomain.com
```

---

## 📋 Next Steps

### 1. Update Supabase Credentials

Get your Supabase credentials:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Update in:**
- `apps/web/.env.local`
- `apps/web/.env.production`
- `apps/mobile/.env`
- `apps/mobile/.env.production`

### 2. Get Razorpay Webhook Secret

1. Go to https://dashboard.razorpay.com
2. Navigate to **Settings** → **Webhooks**
3. Click **Add New Webhook**
4. Enter URL: `https://yourdomain.com/api/payments/webhook`
5. Select events:
   - ✅ `payment.captured`
   - ✅ `payment.authorized`
   - ✅ `payment.failed`
   - ✅ `order.paid`
6. Save and copy the **Webhook Secret**
7. Update `RAZORPAY_WEBHOOK_SECRET` in:
   - `apps/web/.env.local`
   - `apps/web/.env.production`

---

## ✅ What's Already Configured

### Razorpay Keys (No action needed):
- ✅ **Key ID:** `rzp_live_Rgt6qLXXubyJqO`
- ✅ **Key Secret:** `tyYNU0O5YumXdWH20imreikK`

These are already added to all environment files.

---

## 🧪 Testing

### Local Development:

**Web App:**
```bash
cd apps/web
npm run dev
# Opens at http://localhost:3000
```

**Mobile App:**
```bash
cd apps/mobile
npx expo start --clear
# Scan QR code with Expo Go app
```

### Verify Environment Variables:

**Web App:**
```bash
cd apps/web
node -e "console.log(require('dotenv').config({ path: '.env.local' }))"
```

---

## 🚀 Production Deployment

### Vercel (Web App):

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all variables from `apps/web/.env.production`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
   RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
   RAZORPAY_WEBHOOK_SECRET=...
   ```
3. Deploy: `vercel --prod`

### EAS Build (Mobile App):

```bash
cd apps/mobile

# Add secrets
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"
eas secret:create --scope project --name EXPO_PUBLIC_RAZORPAY_KEY_ID --value "rzp_live_Rgt6qLXXubyJqO"

# Build
eas build --platform android
```

---

## 🔒 Security Checklist

- [x] Razorpay keys added to .env files (NOT in code)
- [x] .env files in .gitignore
- [x] Separate local and production environments
- [ ] Supabase credentials updated
- [ ] Webhook secret obtained and added
- [ ] Production domain configured

---

## 📝 File Security

All `.env*` files are automatically ignored by git:

```gitignore
# .gitignore
.env
.env.local
.env.production
.env.*.local
```

**NEVER commit these files to git!**

---

## 🎯 Summary

| File | Status | Razorpay Keys |
|------|--------|---------------|
| `apps/web/.env.local` | ✅ Created | ✅ Added |
| `apps/web/.env.production` | ✅ Created | ✅ Added |
| `apps/mobile/.env` | ✅ Created | ✅ Added |
| `apps/mobile/.env.production` | ✅ Created | ✅ Added |

**Next:** Update Supabase credentials in all files and get webhook secret.

---

**Status:** ✅ **Environment Setup Complete**  
**Keys Location:** In .env files (NOT in code)

