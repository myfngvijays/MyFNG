# 🧪 Telecaller Form Testing Guide

## ✅ Step 1: SQL Migration Complete
**Status**: ✅ Done - `payment_mode` column added

---

## 🧪 Step 2: Test the Form

### Open Form
```
URL: http://localhost:3000/dashboard/telecaller/leads/create
```

### Fill Form Step by Step

#### Step 1: Customer Details
- **Customer Name**: Test Customer
- **Phone**: 9876543210
- **Address**: Test Address, Mumbai
- **City**: Select from dropdown
- Click **Next**

#### Step 2: Vehicle Details
- **Make**: Select "Maruti Suzuki"
- **Model**: Wait for dropdown to populate, select "Swift"
- **Fuel Type**: Petrol
- Click **Next**

#### Step 3: Service Details ⚠️ CRITICAL
- **Service Types**: Check at least 1 service (e.g., General Service)
- **Payment Mode**: Select "COD" or "Prepaid" (MANDATORY)
- Click **Next**

#### Step 4: Pickup & Additional
- **Pickup Required**: Check if needed
- If checked: Click "Get Location" button
- **Lead Priority**: Normal
- Click **Create Lead**

---

## 🔍 Check for Errors

### Browser Console (F12)

Open Developer Tools and check for:

#### ✅ Success (No Errors)
```
✓ Lead created successfully! Lead Number: L-12345678
```

#### ❌ Common Errors

**Error 1: Column not found**
```
error: column "payment_mode" does not exist
```
**Fix**: SQL migration didn't run properly. Run again.

---

**Error 2: Null value violation**
```
error: null value in column "city_id" violates not-null constraint
```
**Fix**: Make sure city is selected from dropdown

---

**Error 3: Check constraint violation**
```
error: new row violates check constraint "service_leads_payment_mode_check"
```
**Fix**: Payment mode value not matching CHECK constraint

---

**Error 4: JSONB parse error**
```
error: invalid input syntax for type json
```
**Fix**: service_types or service_addons array issue

---

### Network Tab (Check API Calls)

**Look for**:
```
POST /rest/v1/service_leads
Status: 201 Created ✅

OR

Status: 400 Bad Request ❌
Status: 500 Internal Server Error ❌
```

---

## 🐛 Debugging Steps

### If Form Submit Fails:

1. **Open Browser Console** (F12)
   ```
   Console → Check for red errors
   ```

2. **Check Network Tab**
   ```
   Network → Filter: Fetch/XHR
   → Look for service_leads request
   → Click on it → Preview/Response
   → See exact error message
   ```

3. **Check Form State** (in console)
   ```javascript
   // Add this temporarily in handleSubmit to see what's being sent
   console.log('Form Data:', formData);
   ```

---

## 🎯 Success Indicators

### ✅ Form Submitted Successfully If:

1. Alert shows: "Lead created successfully!"
2. Redirects to: `/dashboard/telecaller/leads/{id}`
3. Console shows: No errors
4. Network tab shows: 201 Created

### Verify in Database

**Check Supabase Table Editor**:
1. Go to Supabase Dashboard
2. Table Editor → service_leads
3. Find the latest row
4. Verify these columns have data:
   - ✅ `customer_name`
   - ✅ `city_id` (number, not null)
   - ✅ `model_id` (number, not null)
   - ✅ `service_type_ids` (array with IDs)
   - ✅ `subservice_ids` (array or empty)
   - ✅ `payment_mode` (string: PREPAID/COD/etc)
   - ✅ `preferred_slot_end` (timestamp or null)

---

## 🚨 Known Issues & Fixes

### Issue 1: City Dropdown Empty
**Symptom**: No cities show in dropdown
**Cause**: Mock data not loading
**Fix**: Cities are hardcoded, should show. Check console for errors.

### Issue 2: Models Not Populating
**Symptom**: After selecting make, models don't show
**Cause**: fetchModels not working
**Fix**: Check console, models are hardcoded based on make

### Issue 3: GPS Location Not Working
**Symptom**: "Get Location" button doesn't work
**Cause**: Browser location permission denied
**Fix**: Allow location access in browser

### Issue 4: Payment Mode Required Error
**Symptom**: Can't proceed from Step 3
**Cause**: payment_mode not selected
**Fix**: Select payment mode dropdown (MANDATORY field)

### Issue 5: Service Types Required
**Symptom**: "Please select at least one service type"
**Cause**: No service type checked
**Fix**: Check at least 1 service type card

---

## 📊 Test Checklist

### Before Submitting:
- [ ] Customer name filled
- [ ] Phone number (10 digits)
- [ ] Address filled
- [ ] City selected from dropdown
- [ ] Vehicle make selected
- [ ] Vehicle model selected
- [ ] At least 1 service type checked
- [ ] **Payment mode selected** ⚠️ CRITICAL
- [ ] If pickup: Location captured

### After Submitting:
- [ ] No console errors
- [ ] Success alert shown
- [ ] Redirected to lead detail page
- [ ] Lead visible in database
- [ ] All fields saved correctly

---

## 🎉 Success Test Case

**If this works, you're good to go**:

1. Fill all mandatory fields
2. Select "General Service"
3. Select "COD" payment
4. Submit
5. See success message
6. Check database
7. Find new lead with all data

---

## 🆘 If Still Getting Errors

### Check These:

1. **Supabase Connection**
   ```bash
   # Check .env.local
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

2. **RLS Policies**
   - Check if Telecaller role has INSERT permission
   - Supabase → Authentication → Policies

3. **Column Names Match**
   - Form uses: `payment_mode`
   - Database has: `payment_mode`
   - Form uses: `subservice_ids`
   - Database has: `subservice_ids`

4. **Data Types Match**
   - `city_id`: INTEGER
   - `model_id`: INTEGER
   - `service_type_ids`: JSONB
   - `subservice_ids`: JSONB

---

## 📸 Screenshot Errors

If you see an error:
1. Take screenshot of Console
2. Take screenshot of Network tab
3. Copy exact error message
4. Share for debugging

---

**Current Status**: Ready to Test
**Next Step**: Open form and create test lead
**Expected**: Success ✅

