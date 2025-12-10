# Quick Bucket Setup Guide

## ⚠️ Important: Bucket Creation

**Storage buckets CANNOT be created via SQL.**  
They must be created through the Supabase Dashboard.

---

## ✅ Step-by-Step Setup

### Step 1: Create Bucket (Dashboard)

1. **Go to Supabase Dashboard**
   - Login to your project
   - Click **Storage** in left sidebar

2. **Create New Bucket**
   - Click **"New bucket"** button (top right)
   - Fill in:
     - **Name:** `workshop-assets` (exact name required)
     - **Public bucket:** ✅ Check this box (IMPORTANT!)
     - Leave other fields as default
   - Click **"Create bucket"**

### Step 2: Set Up RLS Policies (SQL)

1. **Go to SQL Editor**
   - In Supabase Dashboard, click **SQL Editor**
   - Click **"New query"**

2. **Run RLS Policies SQL**
   - Copy contents from: `database/101_create_workshop_assets_bucket.sql`
   - Paste in SQL Editor
   - Click **"Run"**

---

## ✅ Verification

After setup, verify:

1. **Bucket exists:**
   - Go to Storage → Check if `workshop-assets` bucket is visible

2. **Bucket is public:**
   - Click on `workshop-assets` bucket
   - Settings should show "Public bucket: Yes"

3. **Test upload:**
   - Go to Super Admin → Workshop Public Pages
   - Try uploading an image
   - Should work without errors

---

## ❌ Troubleshooting

**Error: "Storage bucket not configured"**
- ✅ Bucket name is exactly `workshop-assets`
- ✅ Bucket is set as Public
- ✅ RLS policies are created

**Error: "Permission denied"**
- ✅ Logged in as Super Admin
- ✅ RLS policies are in place

**Error: "Bucket not found"**
- ✅ Bucket created via Dashboard
- ✅ Bucket name is correct

---

## 📝 Summary

1. ✅ Create bucket via Dashboard (cannot use SQL)
2. ✅ Run SQL for RLS policies
3. ✅ Test upload functionality

That's it! 🎉
