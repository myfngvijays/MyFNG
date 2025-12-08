# 🔐 Super Admin Pricing Permissions - Complete Guide

## ✅ Permissions Setup Complete

Super Admin ab **zone-wise** aur **city-wise** pricing add/edit/delete kar sakta hai.

---

## 🔒 RLS Policies Configured

### 1. **View Permissions**
- ✅ **Public**: Active pricing dekh sakte hain (is_active = true)
- ✅ **Authenticated Users**: Sab pricing dekh sakte hain (admin dashboard ke liye)

### 2. **Super Admin Permissions**
- ✅ **INSERT**: Super Admin pricing add kar sakta hai
- ✅ **UPDATE**: Super Admin pricing edit kar sakta hai
- ✅ **DELETE**: Super Admin pricing delete kar sakta hai

---

## 🧪 How to Test Permissions

### Step 1: Verify You're Super Admin

```sql
-- Check if current user is Super Admin
SELECT 
  ul.full_name,
  ul.email,
  r.role_code
FROM public.users_login ul
JOIN public.roles r ON ul.role_id = r.id
WHERE ul.id = auth.uid()
  AND r.role_code = 'SUPER_ADMIN';
```

### Step 2: Test Adding Pricing

```sql
-- Add pricing (replace IDs with actual values)
INSERT INTO public.website_service_pricing (
  zone_id,
  city_id,
  service_type_id,
  base_price,
  tax_rate,
  is_active,
  created_by
)
SELECT 
  (SELECT id FROM public.zones WHERE name = 'North Zone'),
  (SELECT id FROM public.cities WHERE name = 'Delhi'),
  (SELECT id FROM public.service_types LIMIT 1),
  500.00,
  18.00,
  true,
  auth.uid()
RETURNING *;
```

### Step 3: Test Updating Pricing

```sql
-- Update pricing
UPDATE public.website_service_pricing
SET 
  base_price = 600.00,
  updated_by = auth.uid(),
  updated_at = NOW()
WHERE id = '<pricing_id>'
RETURNING *;
```

### Step 4: Test Deleting Pricing

```sql
-- Delete pricing
DELETE FROM public.website_service_pricing
WHERE id = '<pricing_id>'
RETURNING *;
```

---

## 🚨 Troubleshooting

### Issue: "Permission denied" error

**Solution 1: Check if you're Super Admin**
```sql
SELECT r.role_code 
FROM users_login ul
JOIN roles r ON ul.role_id = r.id
WHERE ul.id = auth.uid();
```

**Solution 2: Check RLS Policies**
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'website_service_pricing';
```

**Solution 3: Verify auth.uid() is working**
```sql
SELECT auth.uid();  -- Should return your user UUID
```

### Issue: Policies not applying

**Solution: Re-run the CREATE script**
```sql
\i database/CREATE_WEBSITE_SERVICE_PRICING.sql
```

---

## 📋 Super Admin Actions

### ✅ Super Admin CAN:

1. **Add Pricing**
   - Zone-wise pricing
   - City-wise pricing
   - Service-wise pricing
   - Vehicle class-wise pricing (optional)

2. **Edit Pricing**
   - Update base price
   - Update tax rate
   - Activate/Deactivate pricing
   - Change vehicle class

3. **Delete Pricing**
   - Remove pricing entries
   - Clean up old pricing

4. **View All Pricing**
   - All zones
   - All cities
   - All services
   - Active and inactive pricing

### ❌ Super Admin CANNOT:

- ❌ Bypass RLS (security feature)
- ❌ Modify pricing without being logged in
- ❌ Access if not Super Admin role

---

## 🔧 Frontend Integration

### Check Permission in Frontend

```typescript
// Check if user is Super Admin
const isSuperAdmin = async () => {
  const { data } = await supabase
    .from('users_login')
    .select('roles!inner(role_code)')
    .eq('id', userId)
    .eq('roles.role_code', 'SUPER_ADMIN')
    .single();
  
  return !!data;
};

// Use in component
const canManagePricing = await isSuperAdmin();
```

### API Endpoint with Permission Check

```typescript
// apps/web/src/app/api/admin/pricing/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  
  // Check if user is Super Admin
  const { data: user } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: role } = await supabase
    .from('users_login')
    .select('roles!inner(role_code)')
    .eq('id', user.user.id)
    .eq('roles.role_code', 'SUPER_ADMIN')
    .single();

  if (!role) {
    return Response.json({ error: 'Forbidden - Super Admin only' }, { status: 403 });
  }

  // Proceed with pricing operation
  const body = await request.json();
  // ... rest of the code
}
```

---

## 📊 Permission Matrix

| Action | Public | Authenticated | Super Admin |
|--------|--------|---------------|-------------|
| View Active Pricing | ✅ | ✅ | ✅ |
| View All Pricing | ❌ | ✅ | ✅ |
| Add Pricing | ❌ | ❌ | ✅ |
| Edit Pricing | ❌ | ❌ | ✅ |
| Delete Pricing | ❌ | ❌ | ✅ |

---

## ✅ Verification Checklist

- [x] RLS policies created
- [x] Super Admin INSERT policy
- [x] Super Admin UPDATE policy
- [x] Super Admin DELETE policy
- [x] Public view policy
- [x] Authenticated view policy
- [ ] Tested INSERT (Super Admin)
- [ ] Tested UPDATE (Super Admin)
- [ ] Tested DELETE (Super Admin)
- [ ] Frontend permission check implemented

---

## 🎯 Next Steps

1. ✅ **Database permissions** - DONE
2. ⏳ **Test permissions** - Run verification script
3. ⏳ **Frontend integration** - Add permission checks
4. ⏳ **UI components** - Build pricing management UI

---

**Status:** ✅ **Permissions Configured!** Ready for Super Admin to manage pricing.

