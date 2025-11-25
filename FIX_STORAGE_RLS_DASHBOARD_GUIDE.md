# 🔧 Fix Storage RLS Policies - Supabase Dashboard Guide

## Problem
- **Error:** "new row violates row-level security policy"
- **Cause:** The `service-media` bucket doesn't have proper RLS policies

## Solution: Add Policies via Supabase Dashboard

### Step 1: Go to Storage Settings

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Storage** (left sidebar)
4. Find or create the `service-media` bucket

### Step 2: Create/Update the Bucket

**If bucket doesn't exist:**
1. Click **"New bucket"**
2. Name: `service-media`
3. **✅ Check "Public bucket"** (important!)
4. Click **"Create bucket"**

**If bucket exists:**
1. Click on `service-media` bucket
2. Click **"Edit bucket"**
3. **✅ Ensure "Public bucket" is checked**
4. File size limit: `10485760` (10MB)
5. Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp, video/mp4`
6. Click **"Save"**

### Step 3: Add RLS Policies

1. Click on the `service-media` bucket
2. Go to **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Upload Access for Authenticated Users
```
Name: Allow authenticated users to upload
Policy command: INSERT
Target roles: authenticated

WITH CHECK expression:
bucket_id = 'service-media'
```

#### Policy 2: Public Read Access
```
Name: Public read access
Policy command: SELECT
Target roles: public

USING expression:
bucket_id = 'service-media'
```

#### Policy 3: Delete for Mechanics/Admins
```
Name: Allow workshop staff to delete
Policy command: DELETE
Target roles: authenticated

USING expression:
bucket_id = 'service-media' AND
EXISTS (
  SELECT 1 FROM users_login
  JOIN roles ON users_login.role_id = roles.id
  WHERE users_login.id = auth.uid()
  AND roles.role_code IN ('WORKSHOP_MECHANIC', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
)
```

### Step 4: Alternative - Simple Policies (Easier)

If the above is too complex, use these **simpler policies**:

#### Simple Policy 1: Allow All Authenticated Uploads
```
Name: Authenticated upload
Policy: INSERT
Target: authenticated
WITH CHECK: bucket_id = 'service-media'
```

#### Simple Policy 2: Allow Public Read
```
Name: Public read
Policy: SELECT
Target: public
USING: bucket_id = 'service-media'
```

#### Simple Policy 3: Allow Authenticated Delete
```
Name: Authenticated delete
Policy: DELETE
Target: authenticated
USING: bucket_id = 'service-media'
```

### Step 5: Verify

Test by uploading an image through your app. If successful, you'll see:
- ✅ Upload succeeds
- ✅ Image URL is publicly accessible
- ✅ No RLS errors

---

## Quick Fix: Disable RLS (Development Only)

**⚠️ WARNING: Only for development/testing!**

If you need a quick fix for testing:

1. Go to **Storage** → `service-media`
2. Go to **Policies** tab
3. Click **"Disable RLS"** (at the top)

This removes all security but allows uploads to work immediately.

**For Production:** Always use proper RLS policies (Steps above)

---

## Alternative: Use SQL with Service Role

If you have access to service role key, run this in the **SQL Editor**:

```sql
-- Make bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'service-media';

-- Or create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-media', 'service-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

---

## Verify Everything Works

After setting up policies, test:

```javascript
// In browser console or your app
const { data, error } = await supabase.storage
  .from('service-media')
  .upload('test.txt', new Blob(['test']), {
    cacheControl: '3600',
    upsert: false
  });

console.log('Upload result:', { data, error });
```

Should return success without RLS errors!

---

## Common Issues

### Issue: "Bucket not found"
**Solution:** Create the bucket in Supabase Dashboard first

### Issue: "Still getting RLS errors"
**Solution:** 
1. Check policies are created
2. Ensure bucket is marked as public
3. Try disabling RLS temporarily for testing

### Issue: "403 Forbidden"
**Solution:** 
1. Check user is authenticated
2. Verify JWT token is valid
3. Check policies include `authenticated` role

---

## Summary

✅ **Quick Fix (Development):**
1. Create `service-media` bucket
2. Mark it as **Public**
3. Disable RLS temporarily

✅ **Proper Fix (Production):**
1. Create `service-media` bucket as **Public**
2. Add 3 policies (INSERT, SELECT, DELETE)
3. Test uploads work

---

**After this fix, your media uploads should work perfectly!** 🎉

