#!/bin/bash

# ============================================
# Create Environment Files with Razorpay Keys
# For LOCAL and PRODUCTION
# ============================================

echo "🔧 Creating environment files with Razorpay keys..."
echo ""

# ============================================
# WEB APP - LOCAL DEVELOPMENT
# ============================================
echo "📝 Creating apps/web/.env.local (LOCAL)..."
cat > apps/web/.env.local << 'EOF'
# ============================================
# LOCAL DEVELOPMENT ENVIRONMENT
# ============================================

# Supabase Configuration
# Get these from: https://supabase.com/dashboard → Your Project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Razorpay Payment Gateway (LIVE)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard

# Email Configuration (Optional - for invoice sharing)
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
EOF

echo "✅ Created apps/web/.env.local"
echo ""

# ============================================
# WEB APP - PRODUCTION
# ============================================
echo "📝 Creating apps/web/.env.production (PRODUCTION)..."
cat > apps/web/.env.production << 'EOF'
# ============================================
# PRODUCTION ENVIRONMENT
# ============================================

# Supabase Configuration
# Get these from: https://supabase.com/dashboard → Your Project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=your-production-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-anon-key-here
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Razorpay Payment Gateway (LIVE)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-production-email@gmail.com
SMTP_PASS=your-production-app-password

# SMS Configuration
SMS_API_KEY=your-production-sms-api-key
SMS_SENDER_ID=MYFNG

# WhatsApp Configuration
WHATSAPP_API_KEY=your-production-whatsapp-api-key
WHATSAPP_PHONE_NUMBER_ID=your-production-phone-number-id
EOF

echo "✅ Created apps/web/.env.production"
echo ""

# ============================================
# MOBILE APP - LOCAL DEVELOPMENT
# ============================================
echo "📝 Creating apps/mobile/.env (LOCAL)..."
cat > apps/mobile/.env << 'EOF'
# ============================================
# MOBILE APP - LOCAL DEVELOPMENT
# ============================================

# Supabase Configuration
# Get these from: https://supabase.com/dashboard → Your Project → Settings → API
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Razorpay Payment Gateway (LIVE)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO

# API Base URL
EXPO_PUBLIC_API_URL=http://localhost:3000
EOF

echo "✅ Created apps/mobile/.env"
echo ""

# ============================================
# MOBILE APP - PRODUCTION (EAS)
# ============================================
echo "📝 Creating apps/mobile/.env.production (PRODUCTION)..."
cat > apps/mobile/.env.production << 'EOF'
# ============================================
# MOBILE APP - PRODUCTION
# ============================================

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your-production-supabase-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-anon-key-here

# Razorpay Payment Gateway (LIVE)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO

# API Base URL
EXPO_PUBLIC_API_URL=https://yourdomain.com
EOF

echo "✅ Created apps/mobile/.env.production"
echo ""

# ============================================
# SUCCESS MESSAGE
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL ENVIRONMENT FILES CREATED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Files Created:"
echo "  ✅ apps/web/.env.local (Local Development)"
echo "  ✅ apps/web/.env.production (Production)"
echo "  ✅ apps/mobile/.env (Local Development)"
echo "  ✅ apps/mobile/.env.production (Production)"
echo ""
echo "🔑 Razorpay Keys Added:"
echo "  ✅ Key ID: rzp_live_Rgt6qLXXubyJqO"
echo "  ✅ Key Secret: tyYNU0O5YumXdWH20imreikK"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1️⃣  Update Supabase credentials in all files:"
echo "    - Go to: https://supabase.com/dashboard"
echo "    - Copy URL and Anon Key"
echo "    - Update in .env.local and .env.production files"
echo ""
echo "2️⃣  Get Razorpay Webhook Secret:"
echo "    - Go to: https://dashboard.razorpay.com"
echo "    - Navigate to Settings → Webhooks"
echo "    - Create webhook with URL: https://yourdomain.com/api/payments/webhook"
echo "    - Copy webhook secret"
echo "    - Update RAZORPAY_WEBHOOK_SECRET in both .env files"
echo ""
echo "3️⃣  For Production Deployment:"
echo "    - Vercel: Add all variables from .env.production to Vercel Dashboard"
echo "    - Update NEXT_PUBLIC_APP_URL with your actual domain"
echo ""
echo "4️⃣  For Mobile App:"
echo "    - After updating .env, run: cd apps/mobile && npx expo start --clear"
echo ""
echo "🔒 SECURITY NOTE:"
echo "    These .env files are in .gitignore - NEVER commit them to git!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

