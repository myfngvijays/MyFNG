# 🚀 Phase 1 - Quick Start Guide

## Week 1: Database Schema + Lead Manager Flow

---

## ✅ Files Created

1. **`PHASED_IMPLEMENTATION_TIMELINE.md`**
   - Complete 6-week timeline
   - Week-by-week breakdown
   - Milestones & deliverables

2. **`database/phase1_complete_schema_update.sql`**
   - Complete database migration
   - 24 status values
   - 5 new tables
   - 40+ new columns
   - Performance indexes
   - Analytics views

---

## 🎯 What Phase 1 Includes

### Database Updates:
- ✅ 24 lead statuses (from 7 to 24)
- ✅ `invoices` table - Complete billing system
- ✅ `payment_transactions` table - Payment tracking
- ✅ `workshop_payouts` table - Payout management
- ✅ `lead_status_history` table - Audit trail
- ✅ `lead_assignments_history` table - Assignment tracking
- ✅ 40+ new columns in service_leads
- ✅ Performance indexes
- ✅ 3 analytics views

---

## 🚀 How to Run Phase 1 Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   ```
   https://supabase.com/dashboard
   ```

2. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy & Paste Migration**
   - Open `database/phase1_complete_schema_update.sql`
   - Copy entire content
   - Paste in SQL Editor

4. **Run Migration**
   - Click "Run" button (or Cmd/Ctrl + Enter)
   - Wait for completion
   - Check for success message

5. **Verify**
   - Go to "Table Editor"
   - Check new tables exist:
     - `invoices`
     - `payment_transactions`
     - `workshop_payouts`
     - `lead_status_history`
     - `lead_assignments_history`

---

### Option 2: Command Line

```bash
# Navigate to project root
cd /Users/roadserve/Downloads/MyFNG

# Run migration using psql
psql <your-database-url> -f database/phase1_complete_schema_update.sql

# Or using Supabase CLI
supabase db push
```

---

## ✅ Post-Migration Checklist

### 1. Verify Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'invoices',
    'payment_transactions',
    'workshop_payouts',
    'lead_status_history',
    'lead_assignments_history'
  );
```

Expected: 5 rows

### 2. Check ENUM Values
```sql
SELECT unnest(enum_range(NULL::lead_status))::text AS status_value;
```

Expected: 24+ status values including:
- NEW
- INCOMPLETE
- VALIDATED
- ASSIGNED_TO_WORKSHOP
- PENDING_ACCEPTANCE
- etc.

### 3. Verify Columns Added
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
  AND column_name IN (
    'validated_by_id',
    'qc_status',
    'audit_required',
    'invoice_id',
    'closed_by_id'
  );
```

Expected: 5 rows

### 4. Test Analytics Views
```sql
SELECT * FROM lead_status_distribution LIMIT 5;
SELECT * FROM daily_lead_stats LIMIT 5;
SELECT * FROM workshop_performance LIMIT 5;
```

Expected: Data returned successfully

---

## 🎨 Next Steps - Frontend Updates

### After Migration Success:

### 1. Update TypeScript Types
**File:** `shared/types/index.ts`

Add new status types:
```typescript
export type LeadStatus = 
  | 'NEW'
  | 'INCOMPLETE'
  | 'VALIDATED'
  | 'ASSIGNED_TO_WORKSHOP'
  | 'PENDING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'TEAM_ASSIGNED'
  | 'PICKUP_SCHEDULED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'QC_PENDING'
  | 'QC_APPROVED'
  | 'QC_REJECTED'
  | 'AUDIT_PENDING'
  | 'AUDIT_APPROVED'
  | 'AUDIT_FLAGGED'
  | 'INVOICE_GENERATED'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_COMPLETED'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'ESCALATED'
  | 'ON_HOLD';
```

### 2. Update Lead Status Service
**File:** `apps/web/src/lib/services/leadStatusService.ts`

Update status transitions and permissions (I'll create this next).

### 3. Create Lead Manager APIs
**Files to create:**
- `apps/web/src/app/api/lead-manager/leads/[id]/validate/route.ts`
- `apps/web/src/app/api/lead-manager/leads/[id]/assign-workshop/route.ts`
- `apps/web/src/app/api/lead-manager/dashboard/stats/route.ts`

### 4. Update Lead Manager Dashboard
**File:** `apps/web/src/app/dashboard/lead_manager/page.tsx`

Add:
- Validation queue
- Workshop assignment interface
- Incomplete leads section

---

## 📊 Database Schema Summary

### Tables (Total: 5 new)
1. **invoices** - 30 columns
2. **payment_transactions** - 25 columns
3. **workshop_payouts** - 20 columns
4. **lead_status_history** - 10 columns
5. **lead_assignments_history** - 8 columns

### service_leads (40+ new columns)
- Lead Manager: validated_by_id, validated_at, validation_notes
- QC: qc_status, qc_performed_by, qc_performed_at, qc_notes, qc_score
- Audit: audit_required, audit_status, audit_performed_by, audit_score
- Billing: invoice_id, invoice_number, base_amount, extra_charges
- Payment: payment_method, payment_completed_at, payment_due_date
- Closure: closed_by_id, closed_at, closure_notes
- Feedback: customer_rating, customer_feedback
- Fraud: is_fraud, fraud_reason, marked_fraud_by
- Escalation: is_escalated, escalated_to_id, escalation_reason

---

## 💰 Payment System Tables

### invoices
- Complete invoice details
- Tax calculation (CGST/SGST/IGST)
- Discount & coupon support
- PDF generation tracking
- Payment status

### payment_transactions
- Payment gateway integration ready
- Razorpay/Stripe/PhonePe support
- UPI, Card, Netbanking, Wallet
- Refund tracking
- Webhook logs

### workshop_payouts
- Commission calculation (15% default)
- TDS deduction
- Period-based payout
- Bank transfer / UPI support
- Approval workflow

---

## 🔍 Audit & Tracking

### lead_status_history
Every status change is logged:
- Old status → New status
- Who changed it
- When changed
- Reason & notes
- IP address & user agent

### lead_assignments_history
Every assignment is tracked:
- Workshop assignment
- Mechanic assignment
- Supervisor assignment
- Pickup boy assignment
- Lead Manager assignment

---

## 📈 Analytics Views

### lead_status_distribution
```sql
SELECT * FROM lead_status_distribution;
```
Shows:
- Status name
- Count of leads
- Percentage distribution

### daily_lead_stats
```sql
SELECT * FROM daily_lead_stats;
```
Shows per day:
- Total leads
- Completed leads
- Cancelled leads
- Total revenue

### workshop_performance
```sql
SELECT * FROM workshop_performance;
```
Shows per workshop:
- Total leads handled
- Completed vs rejected
- Average rating
- Average completion time

---

## 🎯 Week 1 Roadmap

### Day 1 (Today):
- ✅ Create migration file
- ✅ Create timeline document
- ⏳ Run migration in Supabase
- ⏳ Verify tables created

### Day 2-3:
- Update TypeScript types
- Create Lead Manager APIs
- Create status service

### Day 4-5:
- Update Lead Manager dashboard
- Add validation interface
- Add workshop assignment

### Day 6-7:
- Testing
- Bug fixes
- Documentation

---

## 🚨 Common Issues & Solutions

### Issue 1: ENUM value already exists
**Error:** `ERROR: enum label "VALIDATED" already exists`

**Solution:** Ignore - means it was already added. Continue.

### Issue 2: Column already exists
**Error:** `ERROR: column "validated_by_id" already exists`

**Solution:** Ignore - SQL uses `IF NOT EXISTS`, safe to run multiple times.

### Issue 3: Foreign key constraint fails
**Error:** `ERROR: foreign key constraint fails`

**Solution:** Check if `users_login` table exists and has records.

---

## ✅ Success Criteria

Phase 1 is complete when:
- [ ] Migration runs without errors
- [ ] All 5 tables created
- [ ] All 24 status values added
- [ ] All views working
- [ ] Lead Manager can see dashboard
- [ ] APIs are functional
- [ ] Can validate a lead
- [ ] Can assign workshop

---

## 📞 Support

**Issues?** Check:
1. Database connection
2. User permissions
3. Existing data conflicts
4. Supabase logs

**Ready for Day 2?**
Next: TypeScript types + API creation

---

**Status:** ✅ Phase 1 Database Migration Ready  
**Next:** Run migration → Update types → Create APIs  
**Timeline:** Week 1 of 6  
**Focus:** Lead Manager Flow + Payment System Foundation

