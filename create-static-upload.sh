#!/bin/bash

echo "📦 Creating STATIC upload folder (No Node.js needed)..."
echo ""

# Create upload directory
UPLOAD_DIR="/Users/roadserve/Downloads/MyFNG-STATIC-UPLOAD"
rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"

cd /Users/roadserve/Downloads/MyFNG/apps/web || exit 1

echo "📋 Copying static files from 'out' folder..."
cp -R out/* "$UPLOAD_DIR/"

echo "📝 Creating .htaccess for routing..."
cat > "$UPLOAD_DIR/.htaccess" << 'HTACCESS'
# MyFNG - Static Site Configuration

# Enable Rewrite Engine
RewriteEngine On
RewriteBase /

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Handle Client-Side Routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]

# Security Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Cache Static Assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Gzip Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json
</IfModule>
HTACCESS

echo "📝 Creating README..."
cat > "$UPLOAD_DIR/UPLOAD-INSTRUCTIONS-HINDI.txt" << 'README'
=======================================================
MyFNG - STATIC SITE (NO NODE.JS NEEDED!)
=======================================================

✅ YE SIRF HTML/CSS/JS HAI - NODE.JS KI ZAROORAT NAHI!

🚀 UPLOAD KAISE KARE:
---------------------

1. Hostinger File Manager me login karo
2. public_html/myfng folder me jao
3. PURANI FILES DELETE KARO
4. IS FOLDER KI SAARI FILES UPLOAD KARO
5. BAS! DONE! 🎉

❌ NPM INSTALL YA NPM START KI ZAROORAT NAHI!

📁 IS FOLDER ME KYA HAI:
------------------------
✅ index.html           - Home page
✅ _next/              - Static assets (CSS/JS)
✅ dashboard/          - All dashboard pages
✅ .htaccess           - Server configuration
✅ All HTML files      - Static pages

🌐 SITE URL:
-----------
https://myfng.astric.ai

✅ FAYDE:
--------
- Node.js ki zaroorat nahi
- npm install nahi karna
- Seedha upload karo, chal jayega!
- Astric.ai jaisa simple!
- Fast loading!

Done! 🎊
README

echo ""
echo "✅ Static upload folder ready!"
echo ""
echo "📁 Location: $UPLOAD_DIR"
echo ""
echo "📦 Folder size:"
du -sh "$UPLOAD_DIR"
echo ""
echo "📊 Files count:"
find "$UPLOAD_DIR" -type f | wc -l | xargs echo "Total files:"
echo ""
echo "🎯 Ab bas Hostinger pe upload karo - Node.js ki zaroorat nahi!"
echo ""

# Open folder in Finder
open "$UPLOAD_DIR"

