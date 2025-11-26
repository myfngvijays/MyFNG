#!/bin/bash

# ============================================
# Setup Environment Variables Script
# Adds Razorpay keys to environment files
# ============================================

echo "🔧 Setting up environment variables..."

# Web App .env.local
WEB_ENV_FILE="apps/web/.env.local"
echo ""
echo "📝 Creating/Updating $WEB_ENV_FILE..."

# Check if file exists, if not create it
if [ ! -f "$WEB_ENV_FILE" ]; then
    echo "Creating new .env.local file..."
    cat > "$WEB_ENV_FILE" << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Razorpay Payment Gateway (LIVE)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard
EOF
    echo "✅ Created $WEB_ENV_FILE"
else
    # Check if Razorpay keys already exist
    if grep -q "NEXT_PUBLIC_RAZORPAY_KEY_ID" "$WEB_ENV_FILE"; then
        echo "⚠️  Razorpay keys already exist in $WEB_ENV_FILE"
    else
        echo "" >> "$WEB_ENV_FILE"
        echo "# Razorpay Payment Gateway (LIVE)" >> "$WEB_ENV_FILE"
        echo "NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO" >> "$WEB_ENV_FILE"
        echo "RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK" >> "$WEB_ENV_FILE"
        echo "RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard" >> "$WEB_ENV_FILE"
        echo "✅ Added Razorpay keys to $WEB_ENV_FILE"
    fi
fi

# Mobile App .env
MOBILE_ENV_FILE="apps/mobile/.env"
echo ""
echo "📝 Creating/Updating $MOBILE_ENV_FILE..."

if [ ! -f "$MOBILE_ENV_FILE" ]; then
    echo "Creating new .env file..."
    cat > "$MOBILE_ENV_FILE" << 'EOF'
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url-here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Razorpay Payment Gateway (LIVE)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
EOF
    echo "✅ Created $MOBILE_ENV_FILE"
else
    if grep -q "EXPO_PUBLIC_RAZORPAY_KEY_ID" "$MOBILE_ENV_FILE"; then
        echo "⚠️  Razorpay keys already exist in $MOBILE_ENV_FILE"
    else
        echo "" >> "$MOBILE_ENV_FILE"
        echo "# Razorpay Payment Gateway (LIVE)" >> "$MOBILE_ENV_FILE"
        echo "EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO" >> "$MOBILE_ENV_FILE"
        echo "✅ Added Razorpay keys to $MOBILE_ENV_FILE"
    fi
fi

echo ""
echo "✅ Environment variables setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Update Supabase URL and keys in both .env files"
echo "2. Get webhook secret from Razorpay Dashboard"
echo "3. Update RAZORPAY_WEBHOOK_SECRET in apps/web/.env.local"
echo ""
echo "🔒 Security Note: These files are in .gitignore - never commit them!"

