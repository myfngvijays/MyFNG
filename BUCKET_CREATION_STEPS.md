# 🚨 IMPORTANT: Storage Bucket Creation

## ❌ Error: "must be owner of table buckets"

**This error means:** You cannot create storage buckets via SQL!

**Solution:** Create the bucket through Supabase Dashboard only.

---

## ✅ CORRECT STEPS:

### Step 1: Create Bucket (Dashboard - REQUIRED)

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Storage**
   - Click **"Storage"** in left sidebar
   - You should see "Buckets" tab

3. **Create New Bucket**
   - Click green **"+ New bucket"** button (top right)
   - Fill in:
     - **Name:** `workshop-assets` (exact name, no spaces)
     - **Public bucket:** ✅ **CHECK THIS** (very important!)
   - Click **"Create bucket"**

4. **Verify Bucket Created**
   - You should see `workshop-assets` in the buckets list
   - It should show "PUBLIC" badge

---

### Step 2: Run RLS Policies SQL (Optional)

**ONLY AFTER** bucket is created via Dashboard:

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of: `database/101_create_workshop_assets_bucket.sql`
3. Paste and **Run**
4. This will create the RLS policies (no errors should occur)

---

## 🔍 Quick Verification:

After bucket creation, check:
- ✅ Bucket name: `workshop-assets`
- ✅ Public: Yes
- ✅ Policies: 0 (before running SQL)

After running RLS policies SQL:
- ✅ Policies: 7 (should show policies created)

---

## 💡 Alternative:

If you don't want to create the bucket:
- Use **Image URLs** instead of upload
- The upload button will show error, but URL input works fine
- You can use external image hosting (Imgur, Cloudinary, etc.)

---

**Remember:** Bucket creation = Dashboard only!  
**SQL file = Only for RLS policies!**
