# Pickup OTP Setup Instructions 🔐

## ❌ Current Error:
```
Could not find the 'pickup_otp_verified_at' column of 'service_leads' in the schema cache
```

## ✅ Solution:

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select your project: **MyFNG**
3. Click **SQL Editor** in left sidebar

### Step 2: Run Migration SQL
Copy and paste this SQL:

```sql
-- Add pickup_otp column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_leads' 
    AND column_name = 'pickup_otp'
  ) THEN
    ALTER TABLE service_leads 
    ADD COLUMN pickup_otp VARCHAR(6);
    
    RAISE NOTICE 'Column pickup_otp added successfully';
  ELSE
    RAISE NOTICE 'Column pickup_otp already exists';
  END IF;
END $$;

-- Add pickup_otp_verified_at column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_leads' 
    AND column_name = 'pickup_otp_verified_at'
  ) THEN
    ALTER TABLE service_leads 
    ADD COLUMN pickup_otp_verified_at TIMESTAMP WITH TIME ZONE;
    
    RAISE NOTICE 'Column pickup_otp_verified_at added successfully';
  ELSE
    RAISE NOTICE 'Column pickup_otp_verified_at already exists';
  END IF;
END $$;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
  AND column_name IN ('pickup_otp', 'pickup_otp_verified_at')
ORDER BY column_name;
```

### Step 3: Click "Run" Button
- SQL will execute
- You should see success messages

### Step 4: Verify Columns Created
Expected output:
```
| column_name              | data_type                   | is_nullable |
|--------------------------|----------------------------|-------------|
| pickup_otp               | character varying          | YES         |
| pickup_otp_verified_at   | timestamp with time zone   | YES         |
```

---

## 📋 Column Details:

### `pickup_otp`
- **Type:** VARCHAR(6)
- **Purpose:** Store 6-digit OTP for customer verification
- **Example:** '123456'
- **Nullable:** YES

### `pickup_otp_verified_at`
- **Type:** TIMESTAMP WITH TIME ZONE
- **Purpose:** Store when OTP was verified
- **Example:** '2025-11-25 10:30:00+00'
- **Nullable:** YES (NULL = not verified yet)

---

## 🔄 After Running SQL:

1. ✅ Columns will be added to `service_leads` table
2. ✅ Existing data will not be affected
3. ✅ OTP feature will work immediately
4. ✅ No app restart needed

---

## 🧪 Test the Fix:

1. Refresh your browser page
2. Login as Pickup Boy
3. Click "Start Pickup" on any task
4. Enter OTP: **123456**
5. Should verify successfully! ✅

---

## 📁 SQL File Location:
`/Users/roadserve/Downloads/MyFNG/database/add_pickup_otp_columns.sql`

Run this file in Supabase SQL Editor now! 🚀

