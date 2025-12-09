# User Creation Fix - 500 Error Resolution

## 🔴 Problem:
`POST /auth/v1/signup 500 (Internal Server Error)` when creating users from Super Admin dashboard.

## ✅ Solution:
Created server-side API route that uses **Supabase Admin API** to bypass email confirmation.

## 📋 Changes Made:

### 1. New API Route
**File:** `apps/web/src/app/api/admin/create-user/route.ts`

- Uses Supabase Admin API (`/auth/v1/admin/users`)
- Bypasses email confirmation (`email_confirm: true`)
- Requires SUPER_ADMIN role
- Auto-confirms user email

### 2. Updated User Management Page
**File:** `apps/web/src/app/dashboard/super_admin/users/page.tsx`

- Changed from client-side `supabase.auth.signUp()` 
- Now calls `/api/admin/create-user` API route
- Better error handling

## 🔧 Environment Variable Required:

Add to `apps/web/.env.local`:

```bash
# Supabase Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**How to get Service Role Key:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy "service_role" key (NOT anon key)
4. Add to `.env.local`

⚠️ **IMPORTANT:** Service Role Key has full access - keep it secret!

## 🧪 Testing:

1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
2. Restart dev server: `npm run dev`
3. Try creating a user from Super Admin dashboard
4. Should work without 500 error

## 📝 How It Works:

**Before (Client-side):**
```
Frontend → supabase.auth.signUp() → Email confirmation required → 500 Error
```

**After (Server-side):**
```
Frontend → /api/admin/create-user → Supabase Admin API → Auto-confirm → Success ✅
```

## 🔒 Security:

- ✅ API route checks for SUPER_ADMIN role
- ✅ Service Role Key only on server (never exposed to client)
- ✅ Email auto-confirmed (no email sending required)
- ✅ User can login immediately

---

**Add the environment variable and test again!** 🚀
