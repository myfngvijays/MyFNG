-- Fix RLS policies for invoices table to allow advisor and admin to create invoices
-- Purpose: Allow WORKSHOP_SUPERVISOR and WORKSHOP_ADMIN to insert invoices

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Workshop admins can view their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workshop admins can manage their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Super admins can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workshop supervisors can manage their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workshop staff can insert invoices for their workshop leads" ON public.invoices;

-- Enable RLS
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;

-- Policy 1: Super Admin and Sub Admin can do everything
CREATE POLICY "Super admins can manage all invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Policy 2: Workshop Admin can view and manage invoices for their workshop
CREATE POLICY "Workshop admins can manage their invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    JOIN public.service_leads sl ON sl.id = invoices.lead_id
    WHERE u.id = auth.uid()
    AND r.role_code = 'WORKSHOP_ADMIN'
    AND u.workshop_id = sl.workshop_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    JOIN public.service_leads sl ON sl.id = invoices.lead_id
    WHERE u.id = auth.uid()
    AND r.role_code = 'WORKSHOP_ADMIN'
    AND u.workshop_id = sl.workshop_id
  )
);

-- Policy 3: Workshop Supervisor (Advisor) can view and manage invoices for their workshop
CREATE POLICY "Workshop supervisors can manage their invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    JOIN public.service_leads sl ON sl.id = invoices.lead_id
    WHERE u.id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
    AND u.workshop_id = sl.workshop_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    JOIN public.service_leads sl ON sl.id = invoices.lead_id
    WHERE u.id = auth.uid()
    AND r.role_code = 'WORKSHOP_SUPERVISOR'
    AND u.workshop_id = sl.workshop_id
  )
);

-- Policy 4: Allow insert for workshop staff when creating new invoice
-- In WITH CHECK, we can reference columns directly (not NEW.column)
CREATE POLICY "Workshop staff can insert invoices for their workshop leads"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  -- Super Admin and Sub Admin can insert any invoice
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
  OR
  -- Workshop Admin and Supervisor can insert invoices for their workshop leads
  EXISTS (
    SELECT 1 FROM public.users_login u
    JOIN public.roles r ON u.role_id = r.id
    JOIN public.service_leads sl ON sl.id = invoices.lead_id
    WHERE u.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    AND u.workshop_id = sl.workshop_id
  )
);

