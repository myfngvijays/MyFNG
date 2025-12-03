-- Simple Migration: Update Role Names
-- Purpose: Update role display names in the roles table (Simple version)
-- Date: 2025-12-02
-- Note: Run this if the main script doesn't work due to RLS policies

-- Update Workshop Admin to Workshop Owner
UPDATE public.roles
SET role_name = 'Workshop Owner'
WHERE role_code = 'WORKSHOP_ADMIN';

-- Update Workshop Supervisor to Workshop Adviser  
UPDATE public.roles
SET role_name = 'Workshop Adviser'
WHERE role_code = 'WORKSHOP_SUPERVISOR';

-- Update Workshop Pickup Boy to Pickupboy/Driver
UPDATE public.roles
SET role_name = 'Pickupboy/Driver'
WHERE role_code = 'WORKSHOP_PICKUP_BOY';

-- Verify
SELECT role_code, role_name FROM public.roles 
WHERE role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_PICKUP_BOY')
ORDER BY role_code;

