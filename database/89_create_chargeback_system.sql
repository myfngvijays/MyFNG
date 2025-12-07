-- ============================================
-- CREATE CHARGEBACK MANAGEMENT SYSTEM
-- Date: December 7, 2025
-- Purpose: Handle payment gateway chargebacks and disputes
-- ============================================

-- ============================================
-- SECTION 1: chargeback_cases table
-- ============================================

CREATE TABLE IF NOT EXISTS public.chargeback_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Payment Reference
  payment_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  
  -- Chargeback Details
  chargeback_amount NUMERIC NOT NULL CHECK (chargeback_amount > 0),
  chargeback_reason TEXT NOT NULL,
  chargeback_category VARCHAR(100),
  -- Categories: FRAUD, UNRECOGNIZED, DUPLICATE, SERVICE_NOT_PROVIDED, UNAUTHORIZED, OTHER
  
  -- Payment Gateway Details
  pg_case_id VARCHAR(100) UNIQUE,
  pg_chargeback_id VARCHAR(100),
  pg_provider VARCHAR(50), -- RAZORPAY, STRIPE, PHONEPE, etc.
  pg_notification_data JSONB DEFAULT '{}'::jsonb,
  pg_notification_received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED' CHECK (
    status IN (
      'RECEIVED',           -- Chargeback notification received
      'EVIDENCE_REQUIRED',  -- Need to submit evidence
      'EVIDENCE_SUBMITTED', -- Evidence submitted to PG
      'UNDER_REVIEW',       -- PG reviewing the case
      'WON',                -- We won, chargeback reversed
      'LOST',               -- We lost, amount deducted
      'EXPIRED'             -- Deadline passed without response
    )
  ),
  
  -- Response Deadline
  response_due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  response_submitted_at TIMESTAMP WITH TIME ZONE,
  response_submitted_by UUID REFERENCES public.users_login(id),
  
  -- Evidence Collection
  evidence JSONB DEFAULT '[]'::jsonb,
  -- Array of evidence objects: { type, url, description, uploaded_at }
  evidence_summary TEXT,
  
  -- Evidence types we need to collect:
  -- - Invoice copy
  -- - Service completion proof (images, job card)
  -- - Customer approval/consent
  -- - Delivery proof (OTP verification, photos)
  -- - Communication logs (emails, SMS, WhatsApp)
  -- - Payment authorization proof
  
  -- Customer Details
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_statement TEXT, -- What customer told their bank
  
  -- Our Response
  our_response TEXT,
  defense_summary TEXT,
  defense_strength VARCHAR(20), -- STRONG, MODERATE, WEAK
  
  -- Outcome
  outcome VARCHAR(50), -- WON, LOST, PARTIAL_WIN
  outcome_date TIMESTAMP WITH TIME ZONE,
  outcome_notes TEXT,
  amount_recovered NUMERIC DEFAULT 0,
  amount_lost NUMERIC DEFAULT 0,
  
  -- Financial Impact
  chargeback_fee NUMERIC DEFAULT 0, -- Fee charged by PG for chargeback
  total_loss NUMERIC DEFAULT 0, -- chargeback_amount + chargeback_fee
  
  -- Internal Tracking
  assigned_to UUID REFERENCES public.users_login(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  priority VARCHAR(20) DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL')),
  
  -- Workshop Impact (if workshop is at fault)
  workshop_id UUID REFERENCES public.workshops(id),
  workshop_penalty NUMERIC DEFAULT 0,
  workshop_at_fault BOOLEAN DEFAULT false,
  fault_reason TEXT,
  
  -- Fraud Detection
  suspected_fraud BOOLEAN DEFAULT false,
  fraud_indicators JSONB DEFAULT '[]'::jsonb,
  fraud_score NUMERIC DEFAULT 0,
  
  -- Notes & Communication
  internal_notes TEXT,
  communication_log JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_payment_id ON chargeback_cases(payment_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_invoice_id ON chargeback_cases(invoice_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_lead_id ON chargeback_cases(lead_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_status ON chargeback_cases(status);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_pg_case_id ON chargeback_cases(pg_case_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_response_due_date ON chargeback_cases(response_due_date);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_assigned_to ON chargeback_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chargeback_cases_workshop_id ON chargeback_cases(workshop_id);

-- Comments
COMMENT ON TABLE chargeback_cases IS 'Manages payment gateway chargebacks and dispute resolution';
COMMENT ON COLUMN chargeback_cases.pg_case_id IS 'Unique case ID from payment gateway';
COMMENT ON COLUMN chargeback_cases.evidence IS 'Array of evidence documents: invoices, photos, approvals, delivery proof';
COMMENT ON COLUMN chargeback_cases.response_due_date IS 'Deadline to submit response (typically 7-15 days from notification)';
COMMENT ON COLUMN chargeback_cases.defense_strength IS 'Our assessment of how strong our defense is';

-- ============================================
-- SECTION 2: Update trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_chargeback_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chargeback_cases_updated_at
  BEFORE UPDATE ON chargeback_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_chargeback_cases_updated_at();

-- ============================================
-- SECTION 3: Auto-update payment_transactions when chargeback is created
-- ============================================

CREATE OR REPLACE FUNCTION update_payment_on_chargeback()
RETURNS TRIGGER AS $$
BEGIN
  -- Update payment_transactions with chargeback details
  UPDATE payment_transactions
  SET 
    chargeback_status = NEW.status,
    chargeback_amount = NEW.chargeback_amount,
    chargeback_date = NEW.created_at,
    chargeback_reason = NEW.chargeback_reason
  WHERE id = NEW.payment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_on_chargeback
  AFTER INSERT OR UPDATE OF status, chargeback_amount ON chargeback_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_on_chargeback();

-- ============================================
-- SECTION 4: Calculate total_loss automatically
-- ============================================

CREATE OR REPLACE FUNCTION calculate_chargeback_total_loss()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total loss = chargeback_amount + chargeback_fee
  NEW.total_loss = NEW.chargeback_amount + COALESCE(NEW.chargeback_fee, 0);
  
  -- If outcome is WON, set amount_recovered
  IF NEW.outcome = 'WON' THEN
    NEW.amount_recovered = NEW.chargeback_amount;
    NEW.amount_lost = 0;
  -- If outcome is LOST, set amount_lost
  ELSIF NEW.outcome = 'LOST' THEN
    NEW.amount_recovered = 0;
    NEW.amount_lost = NEW.total_loss;
  -- If outcome is PARTIAL_WIN, calculate based on outcome_notes or keep manual values
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_chargeback_total_loss
  BEFORE INSERT OR UPDATE ON chargeback_cases
  FOR EACH ROW
  EXECUTE FUNCTION calculate_chargeback_total_loss();

-- ============================================
-- SECTION 5: Create finance_event on chargeback status change
-- ============================================

CREATE OR REPLACE FUNCTION create_chargeback_finance_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Create finance event when chargeback status changes
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO finance_events (
      event_type,
      entity_type,
      entity_id,
      actor_id,
      event_data
    ) VALUES (
      CASE NEW.status
        WHEN 'RECEIVED' THEN 'chargeback_received'
        WHEN 'EVIDENCE_SUBMITTED' THEN 'chargeback_evidence_submitted'
        WHEN 'WON' THEN 'chargeback_won'
        WHEN 'LOST' THEN 'chargeback_lost'
        ELSE 'chargeback_status_changed'
      END,
      'chargeback',
      NEW.id,
      NEW.assigned_to,
      jsonb_build_object(
        'chargeback_id', NEW.id,
        'payment_id', NEW.payment_id,
        'invoice_id', NEW.invoice_id,
        'lead_id', NEW.lead_id,
        'status', NEW.status,
        'amount', NEW.chargeback_amount,
        'pg_case_id', NEW.pg_case_id,
        'outcome', NEW.outcome
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_chargeback_finance_event
  AFTER INSERT OR UPDATE OF status, outcome ON chargeback_cases
  FOR EACH ROW
  EXECUTE FUNCTION create_chargeback_finance_event();

-- ============================================
-- SECTION 6: Helper function to collect evidence automatically
-- ============================================

CREATE OR REPLACE FUNCTION auto_collect_chargeback_evidence(
  p_chargeback_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_evidence JSONB := '[]'::jsonb;
  v_case RECORD;
  v_invoice RECORD;
  v_lead RECORD;
  v_job_card RECORD;
BEGIN
  -- Get chargeback case details
  SELECT * INTO v_case FROM chargeback_cases WHERE id = p_chargeback_id;
  
  IF NOT FOUND THEN
    RETURN v_evidence;
  END IF;
  
  -- Get invoice details
  SELECT * INTO v_invoice FROM invoices WHERE id = v_case.invoice_id;
  
  -- Get lead details
  SELECT * INTO v_lead FROM service_leads WHERE id = v_case.lead_id;
  
  -- Get job card
  SELECT * INTO v_job_card FROM job_cards WHERE lead_id = v_case.lead_id;
  
  -- Collect evidence automatically
  
  -- 1. Invoice
  IF v_invoice.id IS NOT NULL THEN
    v_evidence := v_evidence || jsonb_build_object(
      'type', 'invoice',
      'description', 'Invoice copy',
      'data', jsonb_build_object(
        'invoice_number', v_invoice.invoice_number,
        'invoice_date', v_invoice.invoice_date,
        'amount', v_invoice.total_amount,
        'status', v_invoice.status
      )
    );
  END IF;
  
  -- 2. Service completion proof (images)
  v_evidence := v_evidence || jsonb_build_object(
    'type', 'service_completion',
    'description', 'Service completion photos',
    'data', jsonb_build_object(
      'lead_id', v_lead.id,
      'status', v_lead.status,
      'completed_at', v_lead.completed_at
    )
  );
  
  -- 3. Delivery proof (OTP verification)
  IF v_lead.pickup_otp_verified_at IS NOT NULL THEN
    v_evidence := v_evidence || jsonb_build_object(
      'type', 'delivery_proof',
      'description', 'OTP verified delivery',
      'data', jsonb_build_object(
        'otp_verified_at', v_lead.pickup_otp_verified_at,
        'delivered_at', v_lead.completed_at
      )
    );
  END IF;
  
  -- 4. Job card
  IF v_job_card.id IS NOT NULL THEN
    v_evidence := v_evidence || jsonb_build_object(
      'type', 'job_card',
      'description', 'Job card details',
      'data', jsonb_build_object(
        'job_card_number', v_job_card.job_card_number,
        'created_at', v_job_card.created_at
      )
    );
  END IF;
  
  -- 5. Customer approval (for extra charges if any)
  v_evidence := v_evidence || jsonb_build_object(
    'type', 'customer_approval',
    'description', 'Customer approvals and communications',
    'data', jsonb_build_object(
      'lead_id', v_lead.id,
      'customer_name', v_lead.customer_name,
      'customer_phone', v_lead.customer_phone
    )
  );
  
  RETURN v_evidence;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Chargeback management system created successfully!';
    RAISE NOTICE 'Table: chargeback_cases (complete with all fields)';
    RAISE NOTICE 'Triggers: Auto-update payment_transactions, calculate total_loss, create finance_events';
    RAISE NOTICE 'Helper: auto_collect_chargeback_evidence() function for automatic evidence gathering';
    RAISE NOTICE '✅ Ready for chargeback webhook integration!';
END $$;

