# Workshop Assets Storage Bucket Setup Guide

## Bucket Information

**Bucket Name:** `workshop-assets`  
**Purpose:** Store images for workshop public pages (profile, cover, gallery images)  
**Public Access:** Yes (for public workshop pages)

## Setup Methods

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Login to your Supabase project
   - Navigate to **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **"New bucket"** button
   - Fill in the details:
     - **Name:** `workshop-assets`
     - **Public bucket:** ✅ Check this (enables public access)
     - **File size limit:** 5 MB (5242880 bytes)
     - **Allowed MIME types:** `image/jpeg, image/png, image/webp, image/gif`

3. **Set Up RLS Policies**
   - Go to **Storage** → **Policies** tab
   - Select `workshop-assets` bucket
   - Add the following policies (or run the SQL in Method 2):

### Method 2: Using SQL for RLS Policies Only

**IMPORTANT:** The bucket MUST be created via Dashboard first (Method 1).  
This SQL only creates the RLS policies.

**Steps:**
1. First create the bucket using Method 1 (Dashboard)
2. Then go to Supabase Dashboard → **SQL Editor**
3. Click **"New query"**
4. Copy and paste the contents of `101_create_workshop_assets_bucket.sql`
5. Click **"Run"** to create RLS policies

**Note:** You cannot create storage buckets via SQL - only via Dashboard or Admin API.

## Storage Structure

The bucket will store files in this structure:
```
workshop-assets/
  └── workshop-public-pages/
      └── {workshop_id}/
          ├── {timestamp}_{random}.jpg
          ├── {timestamp}_{random}.png
          └── ...
```

## RLS Policies

The bucket has 4 policies:

1. **Public Read Access** - Anyone can view images (for public pages)
2. **Super Admin Upload** - Only Super Admin can upload
3. **Super Admin Update** - Only Super Admin can update
4. **Super Admin Delete** - Only Super Admin can delete

## File Limits

- **Maximum file size:** 5 MB
- **Allowed formats:** JPEG, PNG, WebP, GIF
- **Maximum gallery images:** 25 per workshop
- **Minimum gallery images:** 2 per workshop

## Troubleshooting

### Error: "Storage bucket not configured"
- Make sure the bucket name is exactly `workshop-assets`
- Verify the bucket is set as **Public**
- Check RLS policies are in place

### Error: "Permission denied"
- Verify you're logged in as Super Admin
- Check RLS policies for the bucket
- Ensure the user role is `SUPER_ADMIN`

### Images not loading
- Verify bucket is **Public**
- Check the public URL is correct
- Ensure RLS policy allows public read access

## Verification

After setup, you can verify by:

1. Going to Storage → `workshop-assets` bucket
2. Try uploading a test image from the Super Admin panel
3. Check if the image URL is accessible publicly

## Alternative: Use Image URLs

If you don't want to set up Supabase Storage, you can:
- Use external image hosting (Imgur, Cloudinary, etc.)
- Paste direct image URLs in the form
- The upload functionality will show an error, but URL input will still work
