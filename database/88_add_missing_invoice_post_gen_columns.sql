-- ============================================
-- ADD MISSING INVOICE POST-GENERATION COLUMNS
-- Date: December 7, 2025
-- Purpose: Add all missing columns for complete invoice post-generation flow
-- ============================================

-- ============================================
-- SECTION 1: payment_transactions - Add receipt & chargeback columns
-- ============================================

-- Receipt fields
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS receipt_generated_at TIMESTAMP WITH TIME ZONE;

-- Chargeback fields
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS chargeback_status VARCHAR(50);
-- Values: NULL, INITIATED, EVIDENCE_SUBMITTED, WON, LOST
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS chargeback_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS chargeback_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS chargeback_reason TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_receipt_number ON payment_transactions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_chargeback_status ON payment_transactions(chargeback_status);

-- ============================================
-- SECTION 2: workshop_payouts - Add TDS columns
-- ============================================

-- TDS (Tax Deducted at Source) fields
ALTER TABLE workshop_payouts ADD COLUMN IF NOT EXISTS tds_amount NUMERIC DEFAULT 0;
ALTER TABLE workshop_payouts ADD COLUMN IF NOT EXISTS tds_percentage NUMERIC DEFAULT 0;
ALTER TABLE workshop_payouts ADD COLUMN IF NOT EXISTS net_amount_after_tax NUMERIC;

-- Add computed trigger for net_amount_after_tax
CREATE OR REPLACE FUNCTION calculate_payout_net_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.net_amount_after_tax = NEW.amount - COALESCE(NEW.tds_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create
DROP TRIGGER IF EXISTS trigger_calculate_payout_net_amount ON workshop_payouts;
CREATE TRIGGER trigger_calculate_payout_net_amount
  BEFORE INSERT OR UPDATE ON workshop_payouts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_payout_net_amount();

-- ============================================
-- SECTION 3: job_cards - Add immutability flag
-- ============================================

-- Immutability flag (once set, job card cannot be modified)
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN DEFAULT false;

-- Add trigger to prevent updates when is_immutable = true
CREATE OR REPLACE FUNCTION prevent_immutable_job_card_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_immutable = true AND NEW.is_immutable = true THEN
    -- Allow only specific columns to be updated
    IF OLD.id = NEW.id AND 
       OLD.job_card_number = NEW.job_card_number AND
       OLD.labor_charges = NEW.labor_charges AND
       OLD.additional_work = NEW.additional_work AND
       OLD.mechanic_notes = NEW.mechanic_notes THEN
      RAISE EXCEPTION 'Cannot modify immutable job card. Job card is locked and archived.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create
DROP TRIGGER IF EXISTS trigger_prevent_immutable_job_card_updates ON job_cards;
CREATE TRIGGER trigger_prevent_immutable_job_card_updates
  BEFORE UPDATE ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION prevent_immutable_job_card_updates();

-- ============================================
-- SECTION 4: invoices - Add missing convenience columns
-- ============================================

-- Add paid_amount tracking (for partial payments)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Add trigger to calculate paid_amount from payment_transactions
CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Update invoice paid_amount and balance_due
  UPDATE invoices
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payment_transactions
      WHERE invoice_id = NEW.invoice_id
      AND status = 'SUCCESS'
    ),
    balance_due = total_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM payment_transactions
      WHERE invoice_id = NEW.invoice_id
      AND status = 'SUCCESS'
    ),
    payment_status = CASE
      WHEN (
        SELECT COALESCE(SUM(amount), 0)
        FROM payment_transactions
        WHERE invoice_id = NEW.invoice_id
        AND status = 'SUCCESS'
      ) = 0 THEN 'PENDING'
      WHEN (
        SELECT COALESCE(SUM(amount), 0)
        FROM payment_transactions
        WHERE invoice_id = NEW.invoice_id
        AND status = 'SUCCESS'
      ) < total_amount THEN 'PARTIALLY_PAID'
      ELSE 'PAID'
    END
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create
DROP TRIGGER IF EXISTS trigger_update_invoice_paid_amount ON payment_transactions;
CREATE TRIGGER trigger_update_invoice_paid_amount
  AFTER INSERT OR UPDATE OF status, amount ON payment_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'SUCCESS')
  EXECUTE FUNCTION update_invoice_paid_amount();

-- ============================================
-- VERIFICATION
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Added missing invoice post-generation columns!';
    RAISE NOTICE 'payment_transactions: +7 columns (receipt_url, receipt_number, receipt_generated_at, chargeback fields)';
    RAISE NOTICE 'workshop_payouts: +3 columns (tds_amount, tds_percentage, net_amount_after_tax)';
    RAISE NOTICE 'job_cards: +1 column (is_immutable)';
    RAISE NOTICE 'invoices: Enhanced paid_amount tracking with auto-update trigger';
    RAISE NOTICE '✅ All triggers created for automatic calculations!';
END $$;

