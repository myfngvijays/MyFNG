-- 129: Add delivery receiver/handover proof photo type
-- Purpose: When pickup boy marks vehicle as DELIVERED, capture receiver photo (handover proof)
-- This updates the vehicle_condition_photos.photo_type CHECK constraint to allow:
--  - existing PICKUP_*, DROP_* types
--  - DELIVERY_SIGNATURE (used by mobile UI)
--  - DROP_HANDOVER (new receiver photo)

ALTER TABLE public.vehicle_condition_photos
  DROP CONSTRAINT IF EXISTS vehicle_condition_photos_photo_type_check;

ALTER TABLE public.vehicle_condition_photos
  ADD CONSTRAINT vehicle_condition_photos_photo_type_check
  CHECK (photo_type IN (
    -- Pickup photos
    'PICKUP_FRONT',
    'PICKUP_REAR',
    'PICKUP_LEFT',
    'PICKUP_RIGHT',
    'PICKUP_INTERIOR',
    'PICKUP_DASHBOARD',
    'PICKUP_ODOMETER',
    'PICKUP_DAMAGE',
    'PICKUP_FUEL',
    -- Drop photos
    'DROP_FRONT',
    'DROP_REAR',
    'DROP_LEFT',
    'DROP_RIGHT',
    'DROP_INTERIOR',
    'DROP_DASHBOARD',
    'DROP_ODOMETER',
    'DROP_HANDOVER',
    -- After-work / proofs
    'AFTER_WORK',
    'DELIVERY_SIGNATURE'
  ));

COMMENT ON COLUMN public.vehicle_condition_photos.photo_type IS
  'Vehicle condition + delivery proof photo type (includes DROP_HANDOVER receiver photo and DELIVERY_SIGNATURE)';

