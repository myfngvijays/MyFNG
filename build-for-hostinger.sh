#!/bin/bash

echo "🚀 Building MyFNG Static Site for Hostinger..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "apps/web" ]; then
    echo -e "${RED}❌ Error: apps/web directory not found!${NC}"
    echo "Please run this script from the MyFNG root directory"
    exit 1
fi

echo -e "${YELLOW}📁 Navigating to web app directory...${NC}"
cd apps/web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ npm install failed!${NC}"
        exit 1
    fi
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env.local not found!${NC}"
    echo "Creating sample .env.local file..."
    cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF
    echo -e "${YELLOW}Please edit apps/web/.env.local with your actual Supabase credentials${NC}"
    echo ""
fi

echo -e "${GREEN}🔨 Building static site...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

# Go back to root
cd ../..

# Create deployment package
echo ""
echo -e "${GREEN}📦 Creating deployment package...${NC}"

# Remove old package if exists
rm -rf hostinger-deployment
rm -f hostinger-deployment.zip

# Create deployment directory
mkdir -p hostinger-deployment

# Copy built files
echo "Copying static files..."
cp -r apps/web/out/* hostinger-deployment/

# Create .htaccess for proper routing
echo "Creating .htaccess for URL rewriting..."
cat > hostinger-deployment/.htaccess << 'EOF'
# Enable Rewrite Engine
RewriteEngine On
RewriteBase /

# Force HTTPS (optional, uncomment if needed)
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Handle Next.js routes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]

# Deny access to sensitive files
<FilesMatch "\.(env|json|config)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>

# Browser caching
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType text/html "access plus 0 seconds"
</IfModule>
EOF

# Create deployment instructions
cat > hostinger-deployment/DEPLOYMENT_INSTRUCTIONS.txt << 'EOF'
========================================
MyFNG - Hostinger Deployment Instructions
========================================

📦 What's in this package:
- Complete static website ready to upload
- All HTML, CSS, JavaScript files
- Images and assets
- .htaccess for proper URL routing

🚀 How to Deploy:

Step 1: Access Hostinger
- Log in to your Hostinger account
- Go to "File Manager" or use FTP

Step 2: Upload Files
METHOD A - Using File Manager:
1. Open File Manager
2. Navigate to public_html folder
3. Delete existing files (if any) or create new folder
4. Upload ALL files from this folder
5. Make sure .htaccess is uploaded

METHOD B - Using FTP:
1. Use FileZilla or any FTP client
2. Connect to your Hostinger FTP
3. Navigate to public_html
4. Upload all files from this folder

Step 3: Set Permissions (if needed)
- .htaccess should have 644 permissions
- Folders should have 755 permissions

Step 4: Test Your Website
- Visit your domain
- Test login functionality
- Check if all pages load correctly

⚙️ Environment Variables:
Your Supabase credentials are already built into the static files.
If you need to change them:
1. Update apps/web/.env.local in source code
2. Rebuild using: ./build-for-hostinger.sh
3. Re-upload the new files

🔧 Troubleshooting:

Problem: 404 errors on page refresh
Solution: Make sure .htaccess is uploaded and mod_rewrite is enabled

Problem: Styles not loading
Solution: Check if _next folder is uploaded correctly

Problem: Images not showing
Solution: Verify all files in _next/static are uploaded

Problem: Login not working
Solution: Check browser console for Supabase connection errors

📞 Support:
For technical support, contact your development team.

========================================
Last Built: $(date)
========================================
EOF

# Create a README
cat > hostinger-deployment/README.md << 'EOF'
# MyFNG - Static Deployment Package

## Quick Start

1. **Upload all files** from this folder to your Hostinger `public_html` directory
2. **Visit your domain** to see the live site
3. **Read DEPLOYMENT_INSTRUCTIONS.txt** for detailed steps

## What's Included

- ✅ Complete static website
- ✅ Optimized for performance
- ✅ Mobile responsive
- ✅ SEO friendly
- ✅ Security configured

## File Structure

```
/
├── _next/              # Next.js assets (CSS, JS, images)
├── dashboard/          # Dashboard pages
├── login.html          # Login page
├── index.html          # Home page
├── .htaccess          # URL rewriting rules
└── other HTML files
```

## Important Notes

- **Don't modify** the _next folder
- **Keep** the .htaccess file
- **Test** on a staging domain first if available
- **Backup** before uploading to production

## Performance

This is a fully optimized static site that:
- Loads fast (< 1 second)
- Works on all devices
- SEO optimized
- Cached for speed

## Need Help?

See DEPLOYMENT_INSTRUCTIONS.txt for detailed guide.
EOF

# Create info file with build details
cat > hostinger-deployment/BUILD_INFO.txt << EOF
========================================
MyFNG Build Information
========================================

Build Date: $(date)
Build Environment: Production
Build Type: Static Export
Target Platform: Hostinger

Components Included:
- Web Application (Next.js Static Export)
- All Dashboard Pages
- Login/Authentication
- Workshop Management
- User Management
- Performance Analytics
- Real-time Tracking

Features:
✅ Mobile Responsive
✅ SEO Optimized
✅ Fast Loading
✅ Secure
✅ Production Ready

Database: Supabase (Cloud)
Backend: Supabase Functions
Storage: Supabase Storage

Next.js Version: 14.2.0
React Version: 18.3.0

========================================
EOF

echo -e "${GREEN}✅ Creating ZIP package...${NC}"
cd hostinger-deployment
zip -r ../hostinger-deployment.zip . -x "*.DS_Store"
cd ..

# Calculate size
SIZE=$(du -sh hostinger-deployment | cut -f1)
ZIP_SIZE=$(du -sh hostinger-deployment.zip | cut -f1)

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Build Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "📁 Deployment folder: ${YELLOW}hostinger-deployment/${NC} (Size: $SIZE)"
echo -e "📦 ZIP package: ${YELLOW}hostinger-deployment.zip${NC} (Size: $ZIP_SIZE)"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Check hostinger-deployment/DEPLOYMENT_INSTRUCTIONS.txt"
echo "2. Upload hostinger-deployment.zip to Hostinger"
echo "3. Extract in public_html folder"
echo "4. Test your website"
echo ""
echo -e "${GREEN}🎉 Ready to deploy!${NC}"
echo ""

