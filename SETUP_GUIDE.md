# MyFNG Complete Setup Guide

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ installed
- **Supabase** account (free tier is fine)
- **React Native** development environment (for mobile)
  - iOS: Xcode (Mac only)
  - Android: Android Studio

## 🎨 Brand Guidelines

- **Brand Colors:**
  - my: `#023D95`
  - fng: `#0088E8`
- **Font:** Poppins (already integrated)
- **App Name:** MyFNG

## 🗄️ Database Setup (Already Done on Supabase)

Since your database is already set up, you can skip to **Step 2**.

If you need to recreate or update the database:

1. Go to Supabase Dashboard → SQL Editor
2. Run scripts in order:
   ```
   database/01_schema.sql      (Tables & Enums)
   database/02_functions.sql   (Functions)
   database/03_triggers.sql    (Triggers)
   database/05_seed_data.sql   (17 Roles)
   ```

## 🌐 Web App Setup

### 1. Install Dependencies

```bash
cd apps/web
npm install
```

### 2. Configure Environment

Create `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## 📱 Mobile App Setup

### 1. Install Dependencies

```bash
cd apps/mobile
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Mobile App

```bash
# Start Expo
npm start

# For iOS (Mac only)
npm run ios

# For Android
npm run android
```

## 👥 Creating Users

### Method 1: Through Supabase Dashboard

1. Go to **Authentication** → **Users** → **Add User**
2. Create user with email/password
3. Go to **Table Editor** → `users_login` table
4. Add entry:
   ```sql
   INSERT INTO users_login (id, email, full_name, role_id, is_active)
   VALUES (
     'auth-user-uuid-from-step-2',
     'user@example.com',
     'User Name',
     (SELECT id FROM roles WHERE role_code = 'SUPER_ADMIN'),
     true
   );
   ```

### Method 2: Through SQL

```sql
-- 1. Create auth user (use Supabase dashboard for this)

-- 2. Link to users_login
INSERT INTO users_login (id, email, full_name, role_id, is_active)
VALUES (
  'auth-uuid',
  'admin@myfng.com',
  'Super Admin',
  (SELECT id FROM roles WHERE role_code = 'SUPER_ADMIN'),
  true
);
```

## 🔐 Test Credentials

Create test users for each role:

| Role | Email | Suggested Password |
|------|-------|-------------------|
| SUPER_ADMIN | admin@myfng.com | Test@123 |
| WORKSHOP_ADMIN | workshop@myfng.com | Test@123 |
| LEAD_MANAGER | leads@myfng.com | Test@123 |
| CUSTOMER | customer@myfng.com | Test@123 |

## 📂 Project Structure

```
MyFNG/
├── apps/
│   ├── web/                    # Next.js Web App
│   │   ├── src/
│   │   │   ├── app/           # Pages & Routes
│   │   │   │   ├── page.tsx           # Landing Page
│   │   │   │   ├── login/             # Login Page
│   │   │   │   └── dashboard/         # Role Dashboards
│   │   │   │       ├── super_admin/
│   │   │   │       ├── workshop_admin/
│   │   │   │       ├── lead_manager/
│   │   │   │       └── ... (17 roles)
│   │   │   ├── components/    # Reusable Components
│   │   │   ├── lib/          # Supabase Client
│   │   │   └── store/        # State Management
│   │   └── package.json
│   │
│   └── mobile/                 # React Native App
│       ├── src/
│       │   ├── screens/       # Mobile Screens
│       │   ├── components/    # Mobile Components
│       │   ├── navigation/    # Navigation Setup
│       │   └── constants/     # Theme & Config
│       └── App.tsx
│
├── database/                   # SQL Scripts
│   ├── 01_schema.sql
│   ├── 02_functions.sql
│   ├── 03_triggers.sql
│   └── 05_seed_data.sql
│
├── shared/                     # Shared Code
│   ├── constants/             # Brand, Roles
│   └── types/                 # TypeScript Types
│
└── _archive/                   # Temp/Test Files
```

## 🚀 Key Features Implemented

### ✅ Web Application
- Landing page with brand design
- Role-based authentication
- 17 role-specific dashboards
- Lead accept/reject workflow
- Photo upload component
- GDPR compliance features

### ✅ Mobile Application
- Brand-consistent design
- Cross-platform (iOS & Android)
- Role-based dashboards
- Lead management
- Photo capture & upload
- Real-time updates

## 🎯 Role-Specific Features

### Workshop Admin
- Accept/Reject leads
- Manage workshop staff
- View pending approvals
- Assign jobs to mechanics

### Mechanic
- View assigned jobs
- Upload before/after photos
- Update job status
- Track completed work

### Pickup Boy
- Manage pickup/delivery tasks
- GPS navigation
- Photo documentation
- Status updates

### Lead Manager
- Assign leads to workshops
- Reassign rejected leads
- Track lead status
- Manage workflow

### Customer
- Book services
- Track vehicle status
- View service history
- Contact support

## 🔒 Security & Compliance

- **GDPR Compliant:** Data deletion, consent management, audit logs
- **Row Level Security (RLS):** Database-level access control
- **Role-based permissions:** 17 distinct user roles
- **Secure authentication:** Supabase Auth
- **Audit trail:** All actions logged

## 📸 Photo Upload Feature

Both web and mobile support:
- Before/after service photos
- Pickup/delivery documentation
- Multiple photo upload
- Guidelines for quality

## 🐛 Troubleshooting

### Web App Issues

**Build Errors:**
```bash
rm -rf .next node_modules
npm install
npm run dev
```

**Supabase Connection:**
- Verify `.env.local` variables
- Check Supabase dashboard for correct URL/Key

### Mobile App Issues

**Metro Bundler:**
```bash
npx expo start --clear
```

**iOS Simulator:**
```bash
npx expo run:ios
```

**Android Emulator:**
```bash
npx expo run:android
```

## 📞 Support

For questions or issues:
- Check `README.md` in project root
- Review database schema in `database/` folder
- Check role configurations in `shared/constants/roles.ts`

## 🎉 Next Steps

1. ✅ Create test users for each role
2. ✅ Test login flow
3. ✅ Test role-specific dashboards
4. ✅ Configure RLS policies (if needed)
5. ✅ Test photo upload
6. ✅ Deploy to production

## 📝 Notes

- Database functions already exist in your Supabase
- All 17 roles are configured
- Photo upload requires Supabase Storage bucket named `media`
- GDPR features are ready to use
- Mobile app works on both iOS and Android

---

**Built with:**
- Next.js 14
- React Native (Expo)
- Supabase
- TypeScript
- Tailwind CSS
- Lucide Icons

