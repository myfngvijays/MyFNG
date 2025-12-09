# Book Service Page - RLS Policy Fix

## 🔴 Problem Identified:

**RLS Policies are blocking anonymous/unauthenticated users!**

Current policies only allow:
- ✅ `authenticated` users
- ✅ Specific roles (LEAD_MANAGER, SUPER_ADMIN, etc.)

But `/book-service` page is **PUBLIC** - users don't need to login!

## ✅ Solution:

Run this SQL file to add anonymous access policies:

```sql
-- File: database/89_add_public_access_for_booking.sql
```

This will add policies for:
1. **cities** - Anonymous users can view active cities
2. **car_models** - Anonymous users can view active car models  
3. **service_types** - Anonymous users can view active service types
4. **workshop_service_pricing** - Anonymous users can view pricing

## 📋 Steps to Fix:

### Step 1: Run SQL Migration
```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste contents of: database/89_add_public_access_for_booking.sql
# Click "Run"
```

### Step 2: Verify Policies
```sql
-- Check if policies were created
SELECT 
  tablename,
  policyname,
  roles
FROM pg_policies
WHERE tablename IN ('cities', 'car_models', 'service_types', 'workshop_service_pricing')
  AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
ORDER BY tablename;
```

### Step 3: Test the Page
1. Open: `http://localhost:3000/book-service`
2. Check browser console (F12)
3. Cities should load automatically
4. Car models should be searchable
5. Services should show with pricing

## 🔍 What the Policies Do:

```sql
-- Example: Cities policy
CREATE POLICY "Anonymous users can view active cities"
ON public.cities
FOR SELECT
TO anon, public
USING (is_active = true);
```

This allows:
- ✅ Unauthenticated users (anon role)
- ✅ Public access
- ✅ Only active records (is_active = true)
- ✅ Read-only access (SELECT only)

## ⚠️ Security Note:

These policies are **safe** because:
- ✅ Only SELECT (read) access
- ✅ Only active records shown
- ✅ No sensitive data exposed
- ✅ No write/update/delete access

## 🧪 Testing Checklist:

After running the SQL:

- [ ] Cities dropdown shows cities (not "No cities found")
- [ ] Car model search works
- [ ] Service types load (Basic, General, Premium, Platinum)
- [ ] Pricing displays correctly
- [ ] No console errors about RLS

## 📝 Additional Notes:

**Razorpay Key Error** (separate issue):
```
RAZORPAY_KEY_ID not found. Please add it to .env.local file.
```

Fix: Add to `apps/web/.env.local`:
```
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
```

---

**Run the SQL file and test again!** 🚀
