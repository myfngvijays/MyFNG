# MyFNG Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Get Supabase Credentials (1 min)

1. Open https://app.supabase.com
2. Select your project (where database is already setup)
3. Go to **Settings** → **API**
4. Copy these two values:
   ```
   Project URL: https://xxxxx.supabase.co
   anon public key: eyJhbGc...
   ```

### Step 2: Setup Web App (2 min)

```bash
# Go to web folder
cd apps/web

# Install dependencies (first time only)
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local and paste your credentials
nano .env.local

# Start dev server
npm run dev
```

**Open:** http://localhost:3000 ✅

### Step 3: Setup Mobile App (2 min)

```bash
# Go to mobile folder
cd apps/mobile

# Install dependencies (first time only)
npm install

# Create environment file
cp .env.example .env

# Edit .env and paste your credentials
nano .env

# Start Expo
npm start
```

**Scan QR code** with Expo Go app ✅

---

## 🧪 Test Your Setup

### Create Test User:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **"Add User"**
3. Create user:
   - Email: `admin@test.com`
   - Password: `Test@123`
   - Email Confirm: ✅ Check
4. Copy the User ID (UUID)

### Link User to Role:

Go to **SQL Editor** and run:

```sql
-- Link user to Super Admin role
INSERT INTO users_login (id, email, full_name, role_id, is_active)
VALUES (
  'paste-user-uuid-here',
  'admin@test.com',
  'Test Admin',
  (SELECT id FROM roles WHERE role_code = 'SUPER_ADMIN'),
  true
);
```

### Test Login:

1. **Web:** Go to http://localhost:3000/login
2. **Mobile:** Open app and go to login screen
3. Enter:
   - Email: `admin@test.com`
   - Password: `Test@123`
4. Click Login ✅

**Success!** You should see Super Admin dashboard 🎉

---

## 📝 Create Users for All Roles

Run this in Supabase SQL Editor:

```sql
-- After creating auth users in Supabase Auth UI, link them:

-- Workshop Admin
INSERT INTO users_login (id, email, full_name, role_id, workshop_id, is_active)
VALUES (
  'workshop-admin-uuid',
  'workshop@test.com',
  'Workshop Admin',
  (SELECT id FROM roles WHERE role_code = 'WORKSHOP_ADMIN'),
  (SELECT id FROM workshops LIMIT 1),  -- Link to first workshop
  true
);

-- Lead Manager
INSERT INTO users_login (id, email, full_name, role_id, is_active)
VALUES (
  'lead-manager-uuid',
  'leads@test.com',
  'Lead Manager',
  (SELECT id FROM roles WHERE role_code = 'LEAD_MANAGER'),
  true
);

-- Mechanic
INSERT INTO users_login (id, email, full_name, role_id, workshop_id, is_active)
VALUES (
  'mechanic-uuid',
  'mechanic@test.com',
  'Mechanic',
  (SELECT id FROM roles WHERE role_code = 'WORKSHOP_MECHANIC'),
  (SELECT id FROM workshops LIMIT 1),
  true
);

-- Customer
INSERT INTO users_login (id, email, full_name, role_id, is_active)
VALUES (
  'customer-uuid',
  'customer@test.com',
  'Customer',
  (SELECT id FROM roles WHERE role_code = 'CUSTOMER'),
  true
);
```

---

## 🎨 Verify Brand Colors

Open any page and check:
- ✅ Logo shows **"My"** in `#023D95` (dark blue)
- ✅ Logo shows **"FNG"** in `#0088E8` (light blue)
- ✅ Buttons are `#0088E8` (light blue)
- ✅ Font is **Poppins**

---

## 🧪 Test Key Features

### 1. Test Workshop Admin (Accept/Reject)

**Login as:** `workshop@test.com`

**Test:**
- Dashboard should show "Pending Lead Approvals"
- Click **Accept** button → Lead status becomes ACCEPTED ✅
- Click **Reject** button → Lead status becomes REJECTED ✅

### 2. Test Photo Upload

**Login as:** `mechanic@test.com`

**Test:**
- Go to a job
- Click "Upload Photos"
- Select images
- Upload → Should save to Supabase Storage ✅

### 3. Test Mobile App

**Open mobile app:**
- Login with any test user
- Check bottom tabs: Home, Leads, Profile, Settings ✅
- Navigate between screens ✅
- Check role-specific content ✅

---

## 📂 Project Structure (Quick Reference)

```
MyFNG/
├── apps/
│   ├── web/           ← Next.js web app
│   │   ├── .env.local       ← Your credentials HERE
│   │   └── npm run dev      ← Start web server
│   │
│   └── mobile/        ← React Native app
│       ├── .env             ← Your credentials HERE
│       └── npm start        ← Start mobile app
│
├── database/          ← SQL scripts (already run on Supabase)
│   ├── 01_schema.sql
│   ├── 02_functions.sql
│   ├── 03_triggers.sql
│   └── 05_seed_data.sql     ← Run this to create 17 roles
│
└── Documentation files (README, SETUP_GUIDE, etc.)
```

---

## 🐛 Common Issues

### "Invalid API key"
**Fix:** Check `.env.local` / `.env` file has correct credentials

### "Cannot find module"
**Fix:** Run `npm install` in the respective folder

### Changes not showing
**Fix:** 
- Web: Restart with `npm run dev`
- Mobile: Clear cache with `npx expo start --clear`

### "Table 'roles' does not exist"
**Fix:** Run `database/05_seed_data.sql` in Supabase SQL Editor

---

## ✅ Success Checklist

- [ ] Supabase credentials copied
- [ ] Web app running at localhost:3000
- [ ] Mobile app running on Expo Go
- [ ] Test user created (Super Admin)
- [ ] Can login to web
- [ ] Can login to mobile
- [ ] Dashboard shows correct role
- [ ] Brand colors are correct (#023D95, #0088E8)
- [ ] Poppins font is loading

**All checked? Congratulations! 🎉 Your MyFNG system is running!**

---

## 📞 Next Steps

1. Create more test users for different roles
2. Test accept/reject workflow
3. Test photo upload
4. Create sample leads
5. Test mobile app features
6. Review documentation
7. Deploy to production

---

**Happy Building! 🚀**

