# 🐛 Lead Creation Error - Debug Guide

## Error Shown
"Failed to create lead. Please try again."

This is a generic error. Real error is in browser console.

---

## 🔍 How to Find Real Error

### Step 1: Open Browser Console
```
Press F12
या
Right Click → Inspect → Console tab
```

### Step 2: Clear Console
```
Click 🚫 icon to clear old messages
```

### Step 3: Try Creating Lead Again
```
Fill form → Submit
```

### Step 4: Check Console for Red Error
```
Look for:
"Error creating lead:" 
Followed by actual error message
```

---

## 🚨 Common Errors & Fixes

### Error 1: Column Does Not Exist
```
error: column "payment_mode" does not exist
```
**Fix**: Run SQL migration again
```sql
ALTER TABLE service_leads ADD COLUMN payment_mode VARCHAR(20);
```

---

### Error 2: Null Value Violation
```
error: null value in column "XXX" violates not-null constraint
```
**Likely Columns**:
- `customer_name` - Check if filled
- `customer_phone` - Check if filled
- `vehicle_make` - Check if selected
- `status` - Should be 'NEW' (we're setting it)

**Fix**: Make sure all required fields are filled

---

### Error 3: Foreign Key Violation
```
error: insert or update on table "service_leads" violates foreign key constraint
```
**Possible Issues**:
- `city_id` doesn't exist in cities table
- `model_id` doesn't exist in vehicle_models table
- `created_by_id` doesn't match users_login

**Fix**: 
```sql
-- Check if city_id exists
SELECT * FROM cities WHERE id = <your_city_id>;

-- Check if model_id exists  
SELECT * FROM vehicle_models WHERE id = <your_model_id>;
```

---

### Error 4: Check Constraint Violation
```
error: new row violates check constraint "service_leads_payment_mode_check"
```
**Cause**: Payment mode value not in allowed list

**Fix**: Payment mode must be one of:
- 'PREPAID'
- 'COD'
- 'WALLET'
- 'UPI'
- 'CARD'

---

### Error 5: JSONB Error
```
error: invalid input syntax for type json
```
**Cause**: service_type_ids or subservice_ids array issue

**Fix**: Arrays should be:
```javascript
service_type_ids: [3, 12]  // ✅ Correct
service_type_ids: "[3,12]" // ❌ Wrong (string)
```

---

### Error 6: Permission Denied (RLS)
```
error: new row violates row-level security policy for table "service_leads"
```
**Cause**: Supabase RLS policy blocking insert

**Fix**: Check Supabase policies
```sql
-- Allow telecallers to insert leads
CREATE POLICY "Telecallers can insert leads"
ON service_leads FOR INSERT
TO authenticated
USING (auth.uid() = created_by_id);
```

---

### Error 7: Authentication Error
```
User not authenticated
```
**Cause**: Not logged in

**Fix**: Make sure you're logged in as Telecaller

---

## 🔧 Quick Diagnostic SQL

Run this in Supabase to check everything:

```sql
-- Check if payment_mode column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name = 'payment_mode';

-- Check if subservice_ids exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name = 'subservice_ids';

-- Check if service_type_ids exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name = 'service_type_ids';

-- List all cities (for debugging city_id)
SELECT id, name FROM cities LIMIT 10;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'service_leads';
```

---

## 📝 What to Share for Help

If still stuck, share:

1. **Console Error** (exact text):
```
Copy-paste the red error from console
```

2. **Network Response** (if available):
```
Network tab → service_leads request → Response
```

3. **Form Data** (what you filled):
```
- City selected: Mumbai (id: 2)
- Make selected: Maruti
- Model selected: Swift (id: 204)
- Service types: [3]
- Payment mode: COD
```

---

## 🎯 Most Likely Issues

Based on your setup, most likely:

### Issue 1: city_id Foreign Key
**Problem**: Hardcoded city IDs (1, 2, 3...) don't exist in database

**Solution**: Either:
1. Create cities in database
2. OR make city_id nullable
3. OR use text 'city' column instead

### Issue 2: model_id Foreign Key
**Problem**: Hardcoded model IDs (204, 205...) don't exist

**Solution**: Similar to city_id

### Issue 3: Tables Don't Exist
**Problem**: `lead_events` or `telecaller_call_logs` table missing

**Solution**: Comment out those inserts temporarily:
```javascript
// await supabase.from('lead_events').insert([...]);
// await supabase.from('telecaller_call_logs').insert([...]);
```

---

## 🚀 Quick Test Without Foreign Keys

Try this modified insert (temporarily):

```javascript
// In handleSubmit, change to:
const { data: lead, error: leadError } = await supabase
  .from('service_leads')
  .insert([{
    lead_number: leadNumber,
    customer_name: formData.customer_name,
    customer_phone: formData.customer_phone,
    customer_address: formData.customer_address,
    // city_id: null,  // Skip for now
    vehicle_make: formData.vehicle_make,
    // model_id: null,  // Skip for now
    fuel_type: formData.vehicle_fuel_type,
    service_type_ids: formData.service_types,
    payment_mode: formData.payment_mode,
    status: 'NEW',
    lead_type: 'NORMAL'
  }])
  .select()
  .single();
```

If this works, then foreign key is the issue.

---

## ⚡ Action Items

1. ✅ Open Browser Console (F12)
2. ✅ Try creating lead
3. ✅ Copy exact error message
4. ✅ Share error here
5. ✅ We'll fix based on actual error

---

**Current Status**: Need actual error from console to proceed
**Next Step**: Press F12 → Console → Try submitting → Copy error

