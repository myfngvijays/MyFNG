# Environment Variables Setup Guide

## Overview

Environment variables store sensitive information like database credentials. They should **NEVER** be committed to git.

---

## 🌐 Web App (Next.js)

### Local Development

**File:** `apps/web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Razorpay Payment Gateway
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard

# Car Service Enquiry (server-side only)
CAR_SERVICE_ENQUIRY_POST_URL=https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead
# Optional override (default: DL-Service)
CAR_SERVICE_ENQUIRY_LEADTAG=DL-Service
```

### Where to Get Values:

1. Go to **Supabase Dashboard**
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Production (Vercel/Netlify)

**Supabase automatically handles secrets!** 

But if deploying elsewhere, add environment variables in your hosting platform:

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Netlify:**
1. Go to Site Settings → Build & Deploy → Environment
2. Add same variables

---

## 📱 Mobile App (React Native/Expo)

### Local Development

**File:** `apps/mobile/.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** After adding `.env`, restart Expo:
```bash
# Stop the current server (Ctrl+C)
npx expo start --clear
```

### Production (EAS Build)

**For production builds, use EAS Secrets:**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Set environment variables
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"

# Build
eas build --platform android
eas build --platform ios
```

**Alternative:** Add to `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your-url",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-key"
      }
    }
  }
}
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Use `.env.local` for web (already in .gitignore)
- Use `.env` for mobile (already in .gitignore)
- Use hosting platform's environment variable settings for production
- Use different Supabase projects for dev/staging/production

### ❌ DON'T:
- Never commit `.env` files to git
- Never share keys publicly
- Never use production keys in development
- Never hardcode secrets in code

---

## 📋 Quick Setup Checklist

### Web App:
```bash
cd apps/web
# Copy example file
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
nano .env.local
# Start development server
npm run dev
```

### Mobile App:
```bash
cd apps/mobile
# Copy example file
cp .env.example .env
# Edit .env with your Supabase credentials
nano .env
# Start Expo (with cache clear)
npx expo start --clear
```

---

## 🧪 Testing Your Setup

### Web:
1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Try to login
4. Check browser console for errors

If you see "Invalid API key" → Check your `.env.local`

### Mobile:
1. Start Expo: `npm start`
2. Scan QR code with Expo Go app
3. Try to login
4. Check Expo console for errors

If you see connection errors → Check your `.env`

---

## 🔧 Troubleshooting

### "Supabase URL not found"
- Make sure variable names are correct
- Web: Must start with `NEXT_PUBLIC_`
- Mobile: Must start with `EXPO_PUBLIC_`
- Restart dev server after changes

### "Invalid API key"
- Double-check you copied the **anon** key (not service_role)
- Check for extra spaces in .env file
- Make sure URL includes `https://`

### Changes not reflecting
- **Web:** Restart Next.js server (`Ctrl+C` then `npm run dev`)
- **Mobile:** Clear cache (`npx expo start --clear`)

---

## 📁 File Locations

```
MyFNG/
├── apps/
│   ├── web/
│   │   ├── .env.local          ← Create this for local dev
│   │   └── .env.example        ← Template provided
│   └── mobile/
│       ├── .env                ← Create this for local dev
│       └── .env.example        ← Template provided
└── .env                        ← Your root .env (already setup)
```

---

## 🚀 Production Deployment

### Web (Vercel - Recommended)

Vercel automatically detects Next.js projects:

```bash
cd apps/web
vercel
```

Then add environment variables in Vercel dashboard.

**OR** use Vercel CLI:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Mobile (EAS Build)

```bash
cd apps/mobile
eas build --platform all
```

Environment variables will be pulled from EAS Secrets.

---

## 💡 Pro Tips

1. **Use different Supabase projects:**
   - Development: `myfng-dev`
   - Staging: `myfng-staging`
   - Production: `myfng-prod`

2. **Never expose service_role key** in frontend:
   - Only use `anon` key in web/mobile
   - `service_role` key only for backend/serverless functions

3. **Rotate keys periodically:**
   - Go to Supabase Settings → API
   - Click "Regenerate" if compromised

4. **Test locally before deploying:**
   - Always test with local `.env` files first
   - Verify all features work
   - Then deploy to production

---

## 📞 Need Help?

- **Supabase Docs:** https://supabase.com/docs/guides/getting-started
- **Next.js Env Vars:** https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- **Expo Env Vars:** https://docs.expo.dev/guides/environment-variables/

---

**Your environment is ready! Just add your Supabase credentials and start building! 🚀**

