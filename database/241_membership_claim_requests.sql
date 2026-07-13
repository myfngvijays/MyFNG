-- Pending membership benefit claims (admin WhatsApp approval before usage is recorded)
CREATE TABLE IF NOT EXISTS public.membership_claim_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_membership_id UUID NOT NULL REFERENCES public.customer_memberships(id) ON DELETE CASCADE,
  benefit_code VARCHAR(50) NOT NULL,
  benefit_title VARCHAR(200) NOT NULL,
  vehicle_number VARCHAR(20),
  vehicle_make VARCHAR(120),
  vehicle_model VARCHAR(120),
  vehicle_label VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  membership_usage_id UUID REFERENCES public.membership_usage(id) ON DELETE SET NULL,
  reviewed_by UUID,
  review_source VARCHAR(30),
  review_note TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT membership_claim_requests_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_membership_claim_requests_membership_status
  ON public.membership_claim_requests(customer_membership_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_claim_requests_customer_pending
  ON public.membership_claim_requests(customer_id, status)
  WHERE status = 'PENDING';

COMMENT ON TABLE public.membership_claim_requests IS
  'Membership benefit claim requests awaiting admin approval via WhatsApp or dashboard';

ALTER TABLE public.membership_claim_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages membership claim requests" ON public.membership_claim_requests;
CREATE POLICY "Service role manages membership claim requests" ON public.membership_claim_requests
  FOR ALL USING (true) WITH CHECK (true);
