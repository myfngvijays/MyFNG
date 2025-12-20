-- =====================================================
-- 102: Additional Jobs Master (Workshop-wise)
-- Purpose:
--  - Store reusable "Additional Jobs" catalog (like Product Master)
--  - Allow Super Admin to manage globally + workshop-wise
--  - Allow Workshop Admin / Workshop Supervisor to manage their own workshop items
-- =====================================================

BEGIN;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.additional_jobs_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  hsn_sac_code VARCHAR(20),
  unit VARCHAR(50) DEFAULT 'job',
  oem_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  oes_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  labour_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  created_by UUID NULL REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_additional_jobs_master_workshop_id ON public.additional_jobs_master(workshop_id);
CREATE INDEX IF NOT EXISTS idx_additional_jobs_master_active ON public.additional_jobs_master(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_additional_jobs_master_name ON public.additional_jobs_master(name);

-- Updated_at trigger (best-effort; only if trigger function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_additional_jobs_master_updated_at ON public.additional_jobs_master;
    CREATE TRIGGER trg_additional_jobs_master_updated_at
    BEFORE UPDATE ON public.additional_jobs_master
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 2) RLS
ALTER TABLE public.additional_jobs_master ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS "AJM: authenticated can view" ON public.additional_jobs_master;
DROP POLICY IF EXISTS "AJM: super admin manage" ON public.additional_jobs_master;
DROP POLICY IF EXISTS "AJM: workshop manage" ON public.additional_jobs_master;

-- View: any authenticated user can view active rows
CREATE POLICY "AJM: authenticated can view" ON public.additional_jobs_master
FOR SELECT
USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Super Admin: can do anything (global + workshop-wise)
CREATE POLICY "AJM: super admin manage" ON public.additional_jobs_master
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
      AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Workshop Admin / Supervisor: manage only their workshop rows
CREATE POLICY "AJM: workshop manage" ON public.additional_jobs_master
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND ul.workshop_id IS NOT NULL
      AND ul.workshop_id = additional_jobs_master.workshop_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
      AND ul.workshop_id IS NOT NULL
      AND ul.workshop_id = additional_jobs_master.workshop_id
  )
);

-- 3) Seed: common additional job names (global list; workshop can fill details later)
--    Category-wise (as provided)
WITH seed(name, category) AS (
  VALUES
    -- Routine Parts
    ('Air Filter', 'Routine Parts'),
    ('Spark Plugs', 'Routine Parts'),
    ('Cabin AC Filter', 'Routine Parts'),
    ('Wiper Blades', 'Routine Parts'),
    ('Radiator Service', 'Routine Parts'),
    ('Coolant', 'Routine Parts'),
    ('Power Window Switches', 'Routine Parts'),
    ('Glass Winders', 'Routine Parts'),
    ('Bulbs', 'Routine Parts'),
    ('Battery', 'Routine Parts'),

    -- Suspension/Steering Parts
    ('Front Shock Absorber Assembly', 'Suspension/Steering Parts'),
    ('Front Shock Absorbers', 'Suspension/Steering Parts'),
    ('Front Shock Absorber Kit', 'Suspension/Steering Parts'),
    ('Front Shock Absorbers Mounts', 'Suspension/Steering Parts'),
    ('Front Shock Absorber Bushing Kit', 'Suspension/Steering Parts'),
    ('Front Lower Arm Assembly', 'Suspension/Steering Parts'),
    ('Front Lower Arms Bushing Kit', 'Suspension/Steering Parts'),
    ('Front Upper Arms Bushing Kit', 'Suspension/Steering Parts'),
    ('Front Lower Arm Ball Joints', 'Suspension/Steering Parts'),
    ('Front Upper Arm Ball Joints', 'Suspension/Steering Parts'),
    ('Steering Rack Assembly', 'Suspension/Steering Parts'),
    ('Steering Rack Overhaul', 'Suspension/Steering Parts'),
    ('Steering Tie Rod Ends', 'Suspension/Steering Parts'),
    ('Steering Ball Joints', 'Suspension/Steering Parts'),
    ('Stabilizer Linkages', 'Suspension/Steering Parts'),
    ('Balance Rod Bushes', 'Suspension/Steering Parts'),
    ('Rear Shock Absorber Struts Assembly', 'Suspension/Steering Parts'),
    ('Rear Shock Absorbers', 'Suspension/Steering Parts'),
    ('Rear Shock Absorber Kit', 'Suspension/Steering Parts'),
    ('Rear Lower Arm Assembly', 'Suspension/Steering Parts'),
    ('Rear Lower Arms Bushing Kit', 'Suspension/Steering Parts'),
    ('Rear Lower Ball Joints', 'Suspension/Steering Parts'),
    ('Rear Stabilizer Linkages', 'Suspension/Steering Parts'),

    -- Wheel & Brakes
    ('Front Wheel Bearing', 'Wheel & Brakes'),
    ('Front ABS Wheel Bearing', 'Wheel & Brakes'),
    ('Front Rotor Discs', 'Wheel & Brakes'),
    ('Front Rotor Discs Skimming', 'Wheel & Brakes'),
    ('Front Brake Pads', 'Wheel & Brakes'),
    ('Front Calliper Bushing', 'Wheel & Brakes'),
    ('Rear Wheel Bearing', 'Wheel & Brakes'),
    ('Rear ABS Wheel Bearing', 'Wheel & Brakes'),
    ('Rear Rotor Discs', 'Wheel & Brakes'),
    ('Rear Rotor Discs Skimming', 'Wheel & Brakes'),
    ('Rear Brake Pads/Liners', 'Wheel & Brakes'),
    ('Rear Calliper Bushing', 'Wheel & Brakes'),

    -- Clutch
    ('Clutch Set', 'Clutch'),
    ('Release Bearing', 'Clutch'),
    ('Cable', 'Clutch'),
    ('Master Cylinder', 'Clutch'),
    ('Slave Cylinder', 'Clutch'),
    ('Fly Wheel Skimming', 'Clutch'),
    ('Fly Wheel', 'Clutch'),
    ('Fly Wheel Bearing', 'Clutch'),

    -- Others
    ('Others', 'Others')
)
INSERT INTO public.additional_jobs_master (workshop_id, name, category)
SELECT NULL::uuid, s.name, s.category
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.additional_jobs_master ajm
  WHERE ajm.workshop_id IS NULL
    AND ajm.deleted_at IS NULL
    AND lower(ajm.name) = lower(s.name)
);

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ additional_jobs_master created/updated + RLS policies applied';
END $$;

