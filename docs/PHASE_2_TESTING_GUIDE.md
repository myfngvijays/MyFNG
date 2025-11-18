# 🧪 Phase 2 Testing Guide
## MyFNG Workshop Admin - Feature Testing

---

## 🎯 Quick Start

### Prerequisites
1. Database migrations applied (`06_workshop_admin_enhancements.sql`)
2. Workshop admin account created
3. Test leads with various statuses
4. Supabase Storage bucket configured (`myfng-media`)

---

## 📋 Feature Testing Checklist

### 1. Internal Assignment System

**Test Steps:**
1. Open a lead with status ACCEPTED or later
2. Find the "Internal Assignment" section
3. Test Mechanic Assignment:
   - Select a mechanic from dropdown
   - Click "Assign"
   - Verify success message
   - Check timestamp is displayed
4. Test Pickup Boy Assignment (if pickup required):
   - Select a pickup boy
   - Click "Assign"
   - Verify assignment appears
5. Test Supervisor Assignment:
   - Select a supervisor
   - Assign and verify

**Expected Results:**
- ✅ Dropdowns populated with correct role staff
- ✅ Assignments save successfully
- ✅ Timestamps recorded
- ✅ Event logged in Communication Logs
- ✅ "Currently assigned" indicator shown

---

### 2. Media Upload System

**Test Steps:**
1. Find "Media Section" on any lead
2. Test Image Upload:
   - Select category (e.g., "Inspection")
   - Add caption "Test inspection photo"
   - Choose image file (< 10MB, JPEG/PNG)
   - Upload
3. Test Video Upload:
   - Select category "Progress"
   - Choose video file (< 10MB, MP4)
   - Upload
4. Test Gallery:
   - Click image to preview full-screen
   - Verify video plays inline
   - Test delete button (hover over image)
5. Test Validation:
   - Try uploading file > 10MB (should fail)
   - Try uploading .txt file (should fail)

**Expected Results:**
- ✅ Files upload to Supabase Storage
- ✅ Media organized by category
- ✅ Image preview modal works
- ✅ Videos play in gallery
- ✅ Captions displayed
- ✅ Delete functionality works
- ✅ Validation prevents invalid files

---

### 3. Job Card & Parts System

**Test Steps:**
1. Open ACCEPTED lead
2. Create Job Card:
   - Click "Create Job Card"
   - Set estimated hours: 2.5
   - Add mechanic notes
   - Click "Create"
3. Add Parts:
   - Part 1: "Brake Pad", Part #: "BP-123", Qty: 2, Price: 500, Supplier: "ABC Parts"
   - Part 2: "Engine Oil", Qty: 1, Price: 800
   - Click "Add Part" for each
4. Verify:
   - Parts list displays correctly
   - Total calculation is accurate
   - Delete part button works

**Expected Results:**
- ✅ Unique job card number generated
- ✅ Parts save correctly
- ✅ Total parts cost = sum of (quantity × unit price)
- ✅ Delete removes part
- ✅ Event logged

**Test Calculation:**
```
Part 1: 2 × 500 = 1,000
Part 2: 1 × 800 = 800
Total Parts Cost: 1,800
```

---

### 4. Extra Charges Management

**Test Steps:**
1. On ACCEPTED lead, find "Extra Charges" section
2. Request Charge (< ₹1000):
   - Description: "Additional cleaning"
   - Amount: 500
   - Reason: "Customer requested deep interior cleaning"
   - Submit (no image required)
3. Request Charge (> ₹1000):
   - Description: "Dent repair"
   - Amount: 2500
   - Reason: "Dent found during inspection"
   - Add supporting image
   - Submit
4. Test Approval:
   - Click "Approve" on first charge
   - Click "Reject" on second charge
5. Verify Dashboard:
   - Check Pending count
   - Check Approved total

**Expected Results:**
- ✅ Charges < ₹1000 don't require image
- ✅ Charges > ₹1000 require image (validation works)
- ✅ Status changes to APPROVED/REJECTED
- ✅ Dashboard totals update
- ✅ Supporting images viewable
- ✅ Events logged

---

### 5. Audit & Quality System

**Test Steps:**
1. Change lead status to "READY_FOR_DELIVERY"
2. Find "Audit & Quality" section
3. Start Audit:
   - Click "Start Quality Audit"
   - Verify 10 checklist items appear
4. Complete Checklist:
   - Click checkboxes to mark items
   - Watch progress bar update
5. Complete Audit - PASS:
   - Set score: 85
   - Add remarks: "Excellent work, all checks passed"
   - Click "Complete Audit"
   - Verify status = COMPLETED
6. Test Again - FAIL:
   - Create new lead
   - Start audit
   - Set score: 55
   - Verify status = FAILED

**Expected Results:**
- ✅ 10 checklist items created
- ✅ Progress bar shows completion %
- ✅ Score ≥ 70 → COMPLETED
- ✅ Score < 70 → FAILED
- ✅ Remarks saved
- ✅ Auditor name displayed
- ✅ Completion timestamp shown

---

### 6. Invoice Generation

**Test Steps:**
1. Ensure lead has:
   - Status: READY_FOR_DELIVERY or DELIVERED
   - Job card with parts (e.g., total = ₹1,800)
   - Approved extra charges (e.g., ₹500)
   - Base amount (e.g., ₹3,000)
2. Generate Invoice:
   - Click "Generate Invoice"
   - Wait for success message
3. Verify Breakdown:
   - Base: ₹3,000
   - Parts: ₹1,800
   - Extra: ₹500
   - Subtotal: ₹5,300
   - CGST (9%): ₹477
   - SGST (9%): ₹477
   - Total: ₹6,254
4. Test Actions:
   - Click "Print" → Print dialog opens
   - Click "Download PDF" → Placeholder alert (not implemented yet)
   - Click "Send to Customer" → Placeholder alert
5. Try Duplicate:
   - Click "Generate Invoice" again
   - Should show error "Invoice already generated"

**Expected Results:**
- ✅ Invoice generates with unique number
- ✅ All amounts calculated correctly
- ✅ GST calculation accurate (9% + 9% = 18%)
- ✅ Payment status shows PENDING
- ✅ Due date is 7 days from now
- ✅ Print function works
- ✅ Duplicate prevention works
- ✅ lead.final_amount updated

**Calculation Example:**
```
Base Amount:          ₹3,000.00
Parts Amount:         ₹1,800.00
Extra Charges:        ₹  500.00
-----------------------------------
Subtotal:             ₹5,300.00
CGST @ 9%:            ₹  477.00
SGST @ 9%:            ₹  477.00
===================================
Total Amount:         ₹6,254.00
```

---

### 7. Communication Logs

**Test Steps:**
1. Scroll to "Communication & Activity Logs"
2. Review timeline of all events
3. Test Filter:
   - Select "STATUS_UPDATE" → Only status changes shown
   - Select "MEDIA_UPLOADED" → Only media events shown
   - Select "ALL" → All events shown
4. Expand Event:
   - Click "View Details" on any event
   - Verify JSON data displays

**Expected Results:**
- ✅ All events displayed in timeline
- ✅ Events sorted newest first
- ✅ Icons and colors match event types
- ✅ Timestamps show relative time ("5 minutes ago") and absolute time
- ✅ User names displayed
- ✅ Filter works correctly
- ✅ Event data expandable

---

### 8. Service History

**Test Steps:**
1. Scroll to "Service History"
2. Test Tabs:
   - **Vehicle History Tab:**
     - Shows past leads for same vehicle
     - Displays vehicle summary stats
   - **Customer History Tab:**
     - Shows past leads for same customer
     - Displays customer summary stats
3. Verify Data:
   - Lead numbers
   - Service types
   - Statuses
   - Amounts
   - Ratings (if any)

**Expected Results:**
- ✅ Vehicle history filtered by vehicle_number
- ✅ Customer history filtered by customer_phone
- ✅ Current lead excluded from history
- ✅ Summary stats accurate
- ✅ Empty state shown if no history
- ✅ Tab switching works smoothly

---

### 9. Real-time Notifications

**Test Steps:**
1. Open Workshop Admin dashboard in two browser tabs
2. In Tab 1:
   - Accept a lead
3. In Tab 2:
   - Should see notification appear without refresh
4. Test Browser Notifications:
   - Grant notification permission if prompted
   - Perform action (e.g., assign mechanic)
   - Check if browser notification appears
5. Test Notification Types:
   - Create various events
   - Verify appropriate notification types

**Expected Results:**
- ✅ Real-time updates work across tabs
- ✅ Unread count updates
- ✅ Browser notifications appear (if permitted)
- ✅ Notifications clickable
- ✅ Mark as read functionality works

---

## 🐛 Common Issues & Solutions

### Issue: Media upload fails
**Solution:** 
- Check Supabase Storage bucket exists: `myfng-media`
- Verify RLS policies allow uploads
- Check file size < 10MB

### Issue: Invoice generation fails
**Solution:**
- Ensure lead status is READY_FOR_DELIVERY/DELIVERED/CLOSED
- Check job_cards and lead_extra_charges tables exist
- Verify no existing invoice for this lead

### Issue: Assignment dropdowns empty
**Solution:**
- Verify users exist with correct roles (WORKSHOP_MECHANIC, etc.)
- Check workshop_id matches
- Ensure is_active = true

### Issue: Notifications not appearing
**Solution:**
- Check Supabase Realtime is enabled
- Verify notifications table exists
- Check browser notification permission

---

## 📊 Test Data Setup

### Sample Test Scenario

**Lead Setup:**
```sql
-- Create test lead
INSERT INTO service_leads (
  lead_number, customer_name, customer_phone, vehicle_number,
  vehicle_make, vehicle_model, service_type, status,
  workshop_id, estimated_cost, created_at
) VALUES (
  'LN000999', 'Test Customer', '9876543210', 'MH 01 AB 1234',
  'Maruti', 'Swift', 'General Service', 'ACCEPTED',
  '<workshop_id>', 3000, NOW()
);
```

**Staff Setup:**
```sql
-- Create test mechanic
INSERT INTO users_login (
  email, full_name, role_id, workshop_id, is_active
) VALUES (
  'mechanic1@test.com', 'Test Mechanic', '<mechanic_role_id>', '<workshop_id>', true
);

-- Create test pickup boy
INSERT INTO users_login (
  email, full_name, role_id, workshop_id, is_active
) VALUES (
  'pickup1@test.com', 'Test Pickup Boy', '<pickup_role_id>', '<workshop_id>', true
);
```

---

## ✅ Acceptance Criteria

Phase 2 is considered fully functional when:

- [ ] All 14 sections render correctly on lead detail page
- [ ] Assignment system saves and displays assignments
- [ ] Media uploads successfully to Supabase Storage
- [ ] Job cards created with parts, totals calculate correctly
- [ ] Extra charges can be requested and approved/rejected
- [ ] Audits can be completed with pass/fail determination
- [ ] Invoices generate with accurate GST calculations
- [ ] Communication logs show complete event timeline
- [ ] Service history displays past leads for customer/vehicle
- [ ] Real-time notifications work across browser tabs
- [ ] No console errors in browser DevTools
- [ ] All features work on mobile viewport

---

## 🚀 Performance Testing

### Load Test Scenarios:
1. **Large Media Upload:** Test 20+ images in Media Section
2. **Long Parts List:** Add 50+ parts to job card
3. **Extensive History:** Test customer with 100+ past services
4. **Many Events:** Lead with 200+ events in Communication Logs

**Expected Performance:**
- Page load < 2 seconds
- Media upload < 5 seconds per file
- Filter operations < 500ms
- No UI freezing

---

## 📝 Bug Reporting Template

```
**Bug Title:** [Brief description]

**Feature:** [Which feature: Assignment/Media/Job Card/etc.]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:**
[Attach if applicable]

**Browser:** [Chrome/Firefox/Safari]
**Environment:** [Development/Production]
```

---

## 🎉 Testing Complete!

After completing this testing guide:
1. Document any bugs found
2. Verify all acceptance criteria met
3. Prepare for Phase 3 development
4. Consider user acceptance testing (UAT)

---

**Testing Guide Version:** 1.0  
**Last Updated:** November 17, 2025  
**Next Review:** Before Phase 3 starts

