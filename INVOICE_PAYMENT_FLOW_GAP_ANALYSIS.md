# 📋 INVOICE & PAYMENT FLOW - GAP ANALYSIS DOCUMENT

**Date:** November 26, 2025  
**Reference Document:** User Requirements - 9-Step Invoice + Payment Flow  
**Status:** Gap Analysis Complete

---

## 🎯 OVERVIEW

This document compares the current implementation with the required 9-step invoice and payment flow as per user requirements.

---

## ✅ STEP 1: SUPERVISOR FINAL QC

### Required:
- ✅ Supervisor checks work done as per job card
- ✅ Before/During/After photos verification
- ✅ Extra work validation and approval
- ✅ Mark QC Approved / Ready for Billing
- ✅ Send back to mechanic if NOT OK (status → IN_PROGRESS)

### Current Implementation:
- ✅ API: `/api/supervisor/jobs/[id]/approve-qc` exists
- ✅ Status update: QC_PENDING → QC_APPROVED → READY_FOR_BILLING
- ✅ QC checks table exists
- ⚠️ **GAP:** Need to verify all checklist items match requirements
- ⚠️ **GAP:** Rejection flow sends back to IN_PROGRESS (needs verification)

### Status: ✅ **90% COMPLETE** - Minor enhancements needed

---

## ✅ STEP 2: FINAL CHARGE CONFIRMATION

### Required:
- Compile base service(s) from lead_pricing_items
- Add approved add-ons (semi-synthetic oil, alignment, etc.)
- Add approved extra charges (parts, additional labour)
- Apply discounts/coupons
- Calculate GST/taxes based on place of supply
- System has final billable items

### Current Implementation:
- ✅ Invoice generation API calculates:
  - Base amount from lead.estimated_amount
  - Extra charges from lead_extra_charges (APPROVED)
  - Discount from lead.discount_amount
  - Tax calculation (18% GST - needs to be CGST 9% + SGST 9%)
- ⚠️ **GAP:** Not fetching from lead_pricing_items table
- ⚠️ **GAP:** Tax calculation is 18% flat, should be CGST 9% + SGST 9%
- ⚠️ **GAP:** Place of supply logic not implemented (IGST vs CGST/SGST)
- ⚠️ **GAP:** Add-ons not properly separated from base services

### Status: ⚠️ **70% COMPLETE** - Needs enhancement

---

## ⚠️ STEP 3: INVOICE GENERATION

### Required:
- Create TAX INVOICE record with:
  - Invoice number (auto series)
  - Invoice date & time
  - Link to lead_id & jobcard_id
  - Customer details
  - Vehicle details
  - Line items (service + parts)
  - Tax breakup (CGST/SGST/IGST)
  - Grand total
- Status: INVOICE_GENERATED / AWAITING_PAYMENT

### Current Implementation:
- ✅ API: `/api/billing/leads/[id]/generate-invoice` exists
- ✅ Creates invoice record
- ✅ Updates lead status to INVOICE_GENERATED
- ⚠️ **GAP:** Invoice format doesn't match professional tax invoice template
- ⚠️ **GAP:** Missing fields:
  - HSN/SAC codes for line items
  - Place of supply
  - Amount in words
  - Bank details
  - Terms & conditions
  - Professional invoice layout
- ⚠️ **GAP:** Invoice number format should be: INV-YYYY-NNNNNN (not current format)

### Status: ⚠️ **60% COMPLETE** - Needs major enhancement

---

## ❌ STEP 4: INVOICE REVIEW (MISSING)

### Required:
- Workshop Admin / Billing verifies:
  - No missing items
  - No wrong/additional items
  - Taxes correctly applied
  - Customer name & vehicle number correct
- Mark Invoice Approved (internal flag)

### Current Implementation:
- ❌ **MISSING:** No invoice review step
- ❌ **MISSING:** No invoice approval workflow
- ❌ **MISSING:** No UI for invoice review
- ❌ **MISSING:** No invoice_approved_by, invoice_approved_at fields

### Status: ❌ **0% COMPLETE** - NEEDS IMPLEMENTATION

---

## ⚠️ STEP 5: SHARE INVOICE WITH CUSTOMER

### Required:
- Send invoice via:
  - WhatsApp PDF link
  - SMS link
  - Email PDF
  - In-app "View Invoice" screen
- Customer sees item-wise charges, taxes, final amount, payment options

### Current Implementation:
- ✅ Email service exists: `sendInvoiceEmail()`
- ✅ SMS service exists: `INVOICE_GENERATED` template
- ⚠️ **GAP:** WhatsApp integration not implemented
- ⚠️ **GAP:** PDF generation not implemented (TODO in code)
- ⚠️ **GAP:** Invoice sharing UI not complete
- ⚠️ **GAP:** Customer-facing invoice view page missing
- ⚠️ **GAP:** Payment options not shown in invoice

### Status: ⚠️ **40% COMPLETE** - Needs major work

---

## ⚠️ STEP 6: COLLECT PAYMENT

### Required:
- Customer pays using:
  - Online (UPI, card, netbanking) via payment link
  - Cash at workshop
  - POS Card machine
  - Wallet/credit (if corporate)
- System records:
  - payment_id
  - payment_mode
  - txn_reference (UPI/PG Ref no.)
  - paid_amount
  - paid_at
- Invoice status → PAID

### Current Implementation:
- ✅ Razorpay integration structure exists
- ✅ Payment service: `paymentService.ts`
- ✅ API: `/api/payments/create-order`
- ✅ API: `/api/payments/verify`
- ⚠️ **GAP:** Razorpay keys not configured (user will share)
- ⚠️ **GAP:** Payment UI component not complete
- ⚠️ **GAP:** Cash payment recording missing
- ⚠️ **GAP:** POS payment recording missing
- ⚠️ **GAP:** Payment link generation not implemented
- ⚠️ **GAP:** Payment webhook handler incomplete

### Status: ⚠️ **50% COMPLETE** - Needs completion

---

## ❌ STEP 7: ADD PAYMENT REMARKS (MISSING)

### Required:
- Billing/Workshop Admin fills:
  - "Payment received by: [Staff name]"
  - "Payment remark: e.g. Online UPI, Ref: TXN123456 via Razorpay / Cash received at counter"
  - Any special comment

### Current Implementation:
- ❌ **MISSING:** No payment_remarks field in invoices table
- ❌ **MISSING:** No payment_received_by field
- ❌ **MISSING:** No UI for adding payment remarks
- ❌ **MISSING:** No API for updating payment remarks

### Status: ❌ **0% COMPLETE** - NEEDS IMPLEMENTATION

---

## ✅ STEP 8: VEHICLE DELIVERY

### Required:
- Once invoice is paid (or COD planned):
  - Workshop marks vehicle Ready for Delivery
  - If pickup/delivery service: Assign Delivery (Pickup Boy)
  - Delivery OTP verification at customer side
- Delivery status moves to DELIVERED

### Current Implementation:
- ✅ Pickup/delivery flow exists
- ✅ OTP verification exists
- ✅ Delivery completion API exists
- ⚠️ **GAP:** Need to verify integration with payment flow

### Status: ✅ **90% COMPLETE** - Needs verification

---

## ⚠️ STEP 9: CSE FOLLOW-UP & CLOSURE

### Required:
- CSE calls customer
- Confirms satisfaction
- Logs rating & feedback
- If no issues → mark Lead Closed / COMPLETED
- If any issue → create complaint ticket & escalate

### Current Implementation:
- ✅ API: `/api/cse/leads/[id]/final-call` exists
- ✅ CSE dashboard exists
- ⚠️ **GAP:** Rating collection UI incomplete
- ⚠️ **GAP:** Feedback form not complete
- ⚠️ **GAP:** Complaint ticket creation missing

### Status: ⚠️ **60% COMPLETE** - Needs enhancement

---

## 📊 SUMMARY TABLE

| Step | Feature | Status | Completion |
|------|---------|--------|------------|
| 1 | Supervisor Final QC | ✅ | 90% |
| 2 | Final Charge Confirmation | ⚠️ | 70% |
| 3 | Invoice Generation | ⚠️ | 60% |
| 4 | Invoice Review | ❌ | 0% |
| 5 | Share Invoice with Customer | ⚠️ | 40% |
| 6 | Collect Payment | ⚠️ | 50% |
| 7 | Add Payment Remarks | ❌ | 0% |
| 8 | Vehicle Delivery | ✅ | 90% |
| 9 | CSE Follow-up & Closure | ⚠️ | 60% |

**Overall Completion: 55%**

---

## 🔧 REQUIRED ACTIONS

### High Priority (Critical):
1. ❌ **Implement Invoice Review Step (Step 4)**
2. ❌ **Add Payment Remarks Feature (Step 7)**
3. ⚠️ **Complete Razorpay Payment Integration (Step 6)**
4. ⚠️ **Enhance Invoice Generation to Match Professional Format (Step 3)**

### Medium Priority:
5. ⚠️ **Complete Invoice Sharing (Step 5) - WhatsApp, PDF, Customer View**
6. ⚠️ **Fix Tax Calculation (Step 2) - CGST 9% + SGST 9% instead of 18%**
7. ⚠️ **Enhance CSE Follow-up (Step 9)**

### Low Priority:
8. ⚠️ **Verify Vehicle Delivery Integration (Step 8)**
9. ⚠️ **Enhance Supervisor QC (Step 1)**

---

## 📝 DATABASE CHANGES NEEDED

### invoices table - Add missing fields:
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_approved BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_approved_by UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_received_by UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_remarks TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hsn_sac_codes JSONB;
```

### payment_transactions table - Verify fields:
- ✅ All required fields exist
- ⚠️ May need payment_received_by field

---

## 🎨 UI COMPONENTS NEEDED

1. **Invoice Review Page** (`/dashboard/billing/invoices/[id]/review`)
2. **Payment Collection Page** (`/dashboard/billing/invoices/[id]/payment`)
3. **Payment Remarks Modal** (Add remarks after payment)
4. **Customer Invoice View Page** (`/invoice/[invoice_number]`)
5. **Payment Link Page** (`/pay/[invoice_id]`)
6. **Enhanced Invoice Display** (Professional format)

---

## 🔌 API ENDPOINTS NEEDED

1. `POST /api/billing/invoices/[id]/approve` - Approve invoice
2. `POST /api/billing/invoices/[id]/reject` - Reject invoice with notes
3. `POST /api/billing/invoices/[id]/send` - Send invoice to customer
4. `POST /api/payments/invoices/[id]/record-cash` - Record cash payment
5. `POST /api/payments/invoices/[id]/add-remarks` - Add payment remarks
6. `GET /api/invoices/[invoice_number]` - Public invoice view
7. `POST /api/payments/invoices/[id]/create-link` - Create payment link

---

## 📦 NEXT STEPS

1. ✅ Create this gap analysis document
2. ⏭️ Implement missing database fields
3. ⏭️ Enhance invoice generation API
4. ⏭️ Create invoice review workflow
5. ⏭️ Complete payment collection UI
6. ⏭️ Add payment remarks feature
7. ⏭️ Complete invoice sharing (PDF, WhatsApp, SMS)
8. ⏭️ Create customer-facing invoice view
9. ⏭️ Final verification against requirements

---

**Document Status:** ✅ Complete  
**Next Action:** Start implementation of missing features

