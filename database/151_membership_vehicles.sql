-- Link membership purchases to customer vehicles (primary + optional 2nd car)
-- Run after 141_customer_profile_modules.sql

ALTER TABLE public.customer_memberships
    ADD COLUMN IF NOT EXISTS primary_vehicle_id UUID REFERENCES public.customer_vehicles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS second_vehicle_id UUID REFERENCES public.customer_vehicles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS primary_vehicle_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS second_vehicle_snapshot JSONB DEFAULT '{}'::jsonb;
