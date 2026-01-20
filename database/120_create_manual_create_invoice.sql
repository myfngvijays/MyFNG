-- ============================================================
-- 120_create_manual_create_invoice.sql
-- Purpose: Manual invoices (CSV import) without lead linkage
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.manual_create_invoice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date DATE,
  due_date DATE,

  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(160),
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_state VARCHAR(100),
  customer_pincode VARCHAR(12),

  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',

  status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  notes TEXT,
  created_by UUID REFERENCES public.users_login(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_invoice_created_at
  ON public.manual_create_invoice(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_invoice_status
  ON public.manual_create_invoice(status);
CREATE INDEX IF NOT EXISTS idx_manual_invoice_customer_phone
  ON public.manual_create_invoice(customer_phone);

-- Updated_at trigger (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_manual_invoice_updated_at ON public.manual_create_invoice;
    CREATE TRIGGER trg_manual_invoice_updated_at
      BEFORE UPDATE ON public.manual_create_invoice
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS: SUPER_ADMIN only
ALTER TABLE public.manual_create_invoice ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='manual_create_invoice'
      AND policyname='Super admins can manage manual invoices'
  ) THEN
    CREATE POLICY "Super admins can manage manual invoices"
      ON public.manual_create_invoice
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ manual_create_invoice table created/updated successfully!';
END $$;

