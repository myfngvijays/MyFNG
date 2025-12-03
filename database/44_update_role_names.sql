-- Migration: Update Role Names
-- Purpose: Update role display names in the roles table
-- Date: 2025-12-02

-- First, verify current state
SELECT role_code, role_name, updated_at 
FROM public.roles 
WHERE role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_PICKUP_BOY')
ORDER BY role_code;

-- Check if roles exist before updating
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check WORKSHOP_ADMIN
  SELECT COUNT(*) INTO v_count FROM public.roles WHERE role_code = 'WORKSHOP_ADMIN';
  IF v_count = 0 THEN
    RAISE NOTICE 'WORKSHOP_ADMIN role not found!';
  ELSE
    RAISE NOTICE 'Found WORKSHOP_ADMIN role, updating...';
  END IF;

  -- Check WORKSHOP_SUPERVISOR
  SELECT COUNT(*) INTO v_count FROM public.roles WHERE role_code = 'WORKSHOP_SUPERVISOR';
  IF v_count = 0 THEN
    RAISE NOTICE 'WORKSHOP_SUPERVISOR role not found!';
  ELSE
    RAISE NOTICE 'Found WORKSHOP_SUPERVISOR role, updating...';
  END IF;

  -- Check WORKSHOP_PICKUP_BOY
  SELECT COUNT(*) INTO v_count FROM public.roles WHERE role_code = 'WORKSHOP_PICKUP_BOY';
  IF v_count = 0 THEN
    RAISE NOTICE 'WORKSHOP_PICKUP_BOY role not found!';
  ELSE
    RAISE NOTICE 'Found WORKSHOP_PICKUP_BOY role, updating...';
  END IF;
END $$;

-- Update Workshop Admin to Workshop Owner
UPDATE public.roles
SET 
  role_name = 'Workshop Owner'
WHERE role_code = 'WORKSHOP_ADMIN'
  AND role_name != 'Workshop Owner';

-- Get number of rows updated
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % row(s) for WORKSHOP_ADMIN', v_updated;
END $$;

-- Update Workshop Supervisor to Workshop Adviser
UPDATE public.roles
SET 
  role_name = 'Workshop Adviser'
WHERE role_code = 'WORKSHOP_SUPERVISOR'
  AND role_name != 'Workshop Adviser';

-- Get number of rows updated
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % row(s) for WORKSHOP_SUPERVISOR', v_updated;
END $$;

-- Update Workshop Pickup Boy to Pickupboy/Driver
UPDATE public.roles
SET 
  role_name = 'Pickupboy/Driver'
WHERE role_code = 'WORKSHOP_PICKUP_BOY'
  AND role_name != 'Pickupboy/Driver';

-- Get number of rows updated
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % row(s) for WORKSHOP_PICKUP_BOY', v_updated;
END $$;

-- Verify updates - Check if rows were updated
SELECT 
  role_code, 
  role_name, 
  updated_at,
  CASE 
    WHEN role_code = 'WORKSHOP_ADMIN' AND role_name = 'Workshop Owner' THEN '✓ Updated'
    WHEN role_code = 'WORKSHOP_SUPERVISOR' AND role_name = 'Workshop Adviser' THEN '✓ Updated'
    WHEN role_code = 'WORKSHOP_PICKUP_BOY' AND role_name = 'Pickupboy/Driver' THEN '✓ Updated'
    ELSE '✗ Not Updated'
  END as status
FROM public.roles 
WHERE role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_PICKUP_BOY')
ORDER BY role_code;

