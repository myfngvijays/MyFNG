# 🔐 Environment Variables - Complete Reference

**Last Updated:** November 26, 2025

---

## 📍 File Locations

```
MyFNG/
├── apps/
│   ├── web/
│   │   ├── .env.local          ← Web app environment variables (created)
│   │   └── .env.example         ← Template file
│   └── mobile/
│       ├── .env                 ← Mobile app environment variables (created)
│       └── .env.example         ← Template file
```

---

## 🌐 Web App (.env.local)

**File:** `apps/web/.env.local`

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Razorpay Payment Gateway (LIVE)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS Configuration (Optional)
SMS_API_KEY=your-sms-api-key
SMS_SENDER_ID=MYFNG

# WhatsApp Configuration (Optional)
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
```

---

## 📱 Mobile App (.env)

**File:** `apps/mobile/.env`

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Razorpay Payment Gateway (LIVE)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
```

---

## ✅ Razorpay Keys (Already Configured)

### Live Keys:
- **Key ID:** `rzp_live_Rgt6qLXXubyJqO` ✅
- **Key Secret:** `tyYNU0O5YumXdWH20imreikK` ✅

**Where they're used:**
1. ✅ `apps/web/.env.local` - Web app environment
2. ✅ `apps/mobile/.env` - Mobile app environment
3. ✅ `apps/web/src/lib/services/paymentService.ts` - Fallback in code
4. ✅ `apps/web/src/app/api/payments/create-order/route.ts` - Server API
5. ✅ `apps/web/src/app/api/payments/verify/route.ts` - Verification API
6. ✅ `apps/web/src/app/api/payments/webhook/route.ts` - Webhook handler

---

## 🔧 Quick Setup Script

Run this to automatically setup environment files:

```bash
cd /Users/roadserve/Downloads/MyFNG
bash setup-razorpay-keys.sh
```

This script will:
- ✅ Create `apps/web/.env.local` if not exists
- ✅ Create `apps/mobile/.env` if not exists
- ✅ Add Razorpay keys to both files
- ✅ Preserve existing Supabase configuration

---

## 🚀 Production Deployment

### Vercel (Web App):
```bash
# Add environment variables in Vercel Dashboard
vercel env add NEXT_PUBLIC_RAZORPAY_KEY_ID production
# Enter: rzp_live_Rgt6qLXXubyJqO

vercel env add RAZORPAY_KEY_SECRET production
# Enter: tyYNU0O5YumXdWH20imreikK

vercel env add RAZORPAY_WEBHOOK_SECRET production
# Enter: your_webhook_secret
```

### EAS Build (Mobile App):
```bash
# Add environment variables using EAS CLI
eas secret:create --scope project --name EXPO_PUBLIC_RAZORPAY_KEY_ID --value "rzp_live_Rgt6qLXXubyJqO"
```

---

## 📋 Checklist

### Web App:
- [x] Razorpay Key ID added to `.env.local`
- [x] Razorpay Key Secret added to `.env.local`
- [ ] Webhook Secret obtained from Razorpay Dashboard
- [ ] Supabase URL and Keys added
- [ ] Environment variables tested locally

### Mobile App:
- [x] Razorpay Key ID added to `.env`
- [ ] Supabase URL and Keys added
- [ ] Expo cleared cache: `npx expo start --clear`

### Razorpay Dashboard:
- [ ] Webhook URL configured: `https://yourdomain.com/api/payments/webhook`
- [ ] Webhook Events subscribed:
  - [ ] `payment.captured`
  - [ ] `payment.authorized`
  - [ ] `payment.failed`
  - [ ] `order.paid`
- [ ] Webhook Secret copied to `.env.local`

---

## 🔒 Security Notes

### ✅ DO:
- Keep `.env.local` and `.env` files in `.gitignore`
- Use different keys for development/staging/production
- Rotate keys if compromised
- Store secrets securely

### ❌ DON'T:
- Never commit `.env` files to git
- Never expose `RAZORPAY_KEY_SECRET` in frontend
- Never share keys publicly
- Never use production keys in development

---

## 🧪 Testing

### Test Razorpay Integration:
1. Start web app: `cd apps/web && npm run dev`
2. Navigate to invoice page
3. Click "Pay Now"
4. Use test card: `4111 1111 1111 1111`
5. Verify payment successful

### Test Mobile App:
1. Start mobile app: `cd apps/mobile && npx expo start --clear`
2. Test payment flow
3. Verify Razorpay checkout opens

---

## 📞 Support

**Razorpay Dashboard:** https://dashboard.razorpay.com
**Test Cards:** https://razorpay.com/docs/payments/payments/test-card-details/

---

**Status:** ✅ **Keys Configured and Ready**

