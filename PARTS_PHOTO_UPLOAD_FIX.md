# 🔧 Parts Photo Upload Error - Fix Documentation

## 🚨 **Error:** "Failed to save photo record"

**Location:** Workshop Mechanic Job Completion Page  
**Screenshot Error:** Red banner showing "Failed to save photo record"

---

## 🔍 **Root Cause Analysis**

### Issue:
The `mechanic_job_photos` table has a **CHECK constraint** that only allows specific predefined `photo_type` values. When uploading parts-specific photos like:
- "oil filter - Old Part Removed"
- "oil filter - New Part Installed"  
- "break pad - Old Part Removed"

These dynamic photo types **fail the CHECK constraint** and get rejected by the database.

### Current Constraint:
```sql
photo_type text NOT NULL CHECK (photo_type IN (
  'BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT',
  'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY', 'BEFORE_DAMAGE', 'BEFORE_TYRE',
  'DURING_OIL_DRAIN', 'DURING_OIL_POUR', 'DURING_FILTER_OLD', 'DURING_FILTER_NEW',
  'DURING_BRAKE_BEFORE', 'DURING_BRAKE_AFTER', 'DURING_AC_BEFORE', 'DURING_AC_AFTER',
  'DURING_PART_REMOVAL', 'DURING_PART_INSTALL',
  'AFTER_FRONT', 'AFTER_REAR', 'AFTER_LEFT', 'AFTER_RIGHT',
  'AFTER_ENGINE_BAY', 'AFTER_OLD_PARTS', 'AFTER_NEW_PARTS', 'AFTER_ODOMETER'
))
```

### Where It Fails:
**File:** `apps/web/src/app/api/mechanic/jobs/[id]/upload-photos/route.ts`  
**Line:** 367-384 (Database INSERT operation)

```typescript
const { data: photoRecord, error: photoError } = await supabase
  .from('mechanic_job_photos')
  .insert(photoRecordData)  // ❌ Fails here due to CHECK constraint
  .select()
  .single();
```

---

## ✅ **Solution Options**

### **Option 1: Relax Database Constraint (RECOMMENDED)**

Remove the strict CHECK constraint to allow dynamic photo types.

**Migration File:** `database/90_fix_parts_photo_constraint.sql`

```sql
-- Remove the strict CHECK constraint on photo_type
-- This allows dynamic photo types for parts-specific photos

ALTER TABLE public.mechanic_job_photos 
  DROP CONSTRAINT IF EXISTS mechanic_job_photos_photo_type_check;

-- Add a more flexible constraint
-- Allow predefined types + any text starting with part name
ALTER TABLE public.mechanic_job_photos
  ADD CONSTRAINT mechanic_job_photos_photo_type_check
  CHECK (
    photo_type IN (
      -- BEFORE INSPECTION
      'BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT',
      'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY', 'BEFORE_DAMAGE', 'BEFORE_TYRE',
      -- DURING SERVICE
      'DURING_OIL_DRAIN', 'DURING_OIL_POUR', 'DURING_FILTER_OLD', 'DURING_FILTER_NEW',
      'DURING_BRAKE_BEFORE', 'DURING_BRAKE_AFTER', 'DURING_AC_BEFORE', 'DURING_AC_AFTER',
      'DURING_PART_REMOVAL', 'DURING_PART_INSTALL',
      -- AFTER SERVICE
      'AFTER_FRONT', 'AFTER_REAR', 'AFTER_LEFT', 'AFTER_RIGHT',
      'AFTER_ENGINE_BAY', 'AFTER_OLD_PARTS', 'AFTER_NEW_PARTS', 'AFTER_ODOMETER'
    )
    OR
    -- Allow any text for parts-specific photos (must contain '-')
    (photo_type LIKE '%-%' AND LENGTH(photo_type) < 200)
  );

-- Add comment for clarity
COMMENT ON COLUMN public.mechanic_job_photos.photo_type IS 
  'Photo type: predefined types OR parts-specific format (e.g., "oil filter - Old Part Removed")';
```

**Why This Works:**
- ✅ Keeps validation for standard photo types
- ✅ Allows dynamic part names with separators (e.g., "part name - Old Part Removed")
- ✅ Prevents abuse with length limit (< 200 characters)
- ✅ No code changes needed!

---

### **Option 2: Add `part_name` Column**

Store part-specific info separately.

**Migration File:** `database/90_add_part_name_column.sql`

```sql
-- Add part_name column to store the actual part name
ALTER TABLE public.mechanic_job_photos
  ADD COLUMN IF NOT EXISTS part_name TEXT;

-- Add index for searching by part
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_part_name 
  ON public.mechanic_job_photos(part_name);

-- Add comment
COMMENT ON COLUMN public.mechanic_job_photos.part_name IS 
  'Part name for parts-specific photos (e.g., "oil filter", "break pad")';
```

**Code Changes Required:**
File: `apps/web/src/app/api/mechanic/jobs/[id]/upload-photos/route.ts`

```typescript
// Line 350-365: Update photoRecordData
const photoRecordData: any = {
  job_id: jobData.id,
  lead_id: leadId,
  photo_type: photoType,  // Use generic type: 'PARTS_OLD_REMOVED' or 'PARTS_NEW_INSTALLED'
  part_name: extractPartName(photoType),  // Extract part name from original type
  photo_category: photoCategory,
  photo_url: photoUrl,
  uploaded_by: user.id,
  latitude: latitude ? parseFloat(latitude) : null,
  longitude: longitude ? parseFloat(longitude) : null,
  odometer_reading: odometerReading ? parseFloat(odometerReading) : null,
  exif_data: exifDataParsed,
  ...(partId && { part_id: partId }),
  annotations: annotationsParsed,
  notes: notes || null,
};

// Helper function
function extractPartName(photoType: string): string | null {
  // Extract part name from types like "oil filter - Old Part Removed"
  const match = photoType.match(/^(.+?)\s*-\s*(.+)$/);
  return match ? match[1].trim() : null;
}
```

**Why This Might Be Better:**
- ✅ Structured data
- ✅ Easy queries by part name
- ✅ Maintains constraint integrity
- ❌ Requires code changes
- ❌ More complex implementation

---

### **Option 3: Use `part_id` Reference**

Link photos to `mechanic_parts_usage` table.

**Migration:** Already exists! The table has `part_id` column.

**Code Changes:**
Ensure `part_id` is passed when uploading parts-specific photos.

**File:** `apps/web/src/components/mechanic/PartsUsageUpload.tsx` (if exists)

```typescript
// When uploading part photo, include part_id
formData.append('partId', partUsageRecord.id);
formData.append('photo_type', 'AFTER_OLD_PARTS'); // Use generic type
```

---

## 🎯 **Recommended Implementation**

### **Go with Option 1** (Relax Constraint)

**Why?**
1. ✅ **Quickest fix** - No code changes needed
2. ✅ **Backward compatible** - Existing photos still work
3. ✅ **Flexible** - Supports any part name format
4. ✅ **Single migration** - Easy to deploy

### **Steps:**

1. **Create migration file:**
```bash
touch database/90_fix_parts_photo_constraint.sql
```

2. **Copy the SQL from Option 1** above

3. **Run migration on Supabase:**
   - Go to Supabase Dashboard
   - SQL Editor
   - Paste migration
   - Run

4. **Test:**
   - Try uploading parts photos again
   - Should work without "Failed to save photo record" error

---

## 🧪 **Testing After Fix**

### Test Cases:
1. ✅ Upload standard photos (BEFORE_FRONT, AFTER_REAR, etc.)
2. ✅ Upload parts-specific photos ("oil filter - Old Part Removed")
3. ✅ Upload "All Old Parts Photo"
4. ✅ Verify photos appear in job detail page
5. ✅ Check database records inserted correctly

### Verification Query:
```sql
-- Check recent uploads
SELECT 
  id,
  photo_type,
  photo_category,
  part_name,  -- If Option 2 implemented
  created_at
FROM mechanic_job_photos
WHERE lead_id = 'YOUR_LEAD_ID'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 **Additional Notes**

### Current Upload Flow:
1. Mechanic selects photo from device
2. `AfterServiceUpload.tsx` component handles file
3. Calls `/api/mechanic/jobs/[id]/upload-photos`
4. API uploads to Supabase Storage (`service-media` bucket)
5. **Inserts record to `mechanic_job_photos` table** ← FAILS HERE
6. Returns success/error to UI

### Error Handling:
The API properly:
- ✅ Cleans up uploaded file if database insert fails (line 376-380)
- ✅ Returns detailed error message (line 382-384)
- ✅ Logs error to console (line 374)

### UI Display:
Error toast appears in red banner at top of page (screenshot shows this).

---

## 🚀 **Deploy Steps**

```bash
# 1. Create migration
cat > database/90_fix_parts_photo_constraint.sql <<'EOF'
-- (Paste Option 1 SQL here)
EOF

# 2. Run in Supabase
# Go to Supabase Dashboard → SQL Editor → Run migration

# 3. Verify
# Upload a parts photo
# Check for success

# 4. Commit
git add database/90_fix_parts_photo_constraint.sql
git commit -m "fix: Allow dynamic photo types for parts-specific photos

- Relaxed CHECK constraint on mechanic_job_photos.photo_type
- Now supports part-specific names (e.g., 'oil filter - Old Part Removed')
- Maintains validation for standard photo types
- Fixes 'Failed to save photo record' error

Issue: Parts photos with dynamic names were failing database constraint
Solution: Updated constraint to allow flexible part names with '-' separator"

git push origin main
```

---

## ✅ **Success Criteria**

After implementing Option 1:
- ✅ Parts photos upload successfully
- ✅ No "Failed to save photo record" error
- ✅ Photos visible in job completion page
- ✅ Standard photo types still work
- ✅ No code changes required
- ✅ Database integrity maintained

---

**Status:** Ready to Deploy  
**Priority:** HIGH (Blocking mechanic job completion)  
**Effort:** 5 minutes  
**Risk:** LOW (Only relaxes constraint, doesn't break existing data)

