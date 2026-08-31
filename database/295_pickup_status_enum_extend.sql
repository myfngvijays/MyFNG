-- Extend pickup_status enum on pickup_tracking (older DBs created before 08_workshop_pickup_boy_enhancements).
-- Run outside a transaction if ADD VALUE fails in your client.
-- Safe to re-run: each block checks pg_enum first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'pickup_status' AND e.enumlabel = 'ON_THE_WAY'
  ) THEN
    ALTER TYPE pickup_status ADD VALUE 'ON_THE_WAY';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'pickup_status' AND e.enumlabel = 'OTP_VERIFIED'
  ) THEN
    ALTER TYPE pickup_status ADD VALUE 'OTP_VERIFIED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'pickup_status' AND e.enumlabel = 'VEHICLE_IN_TRANSIT'
  ) THEN
    ALTER TYPE pickup_status ADD VALUE 'VEHICLE_IN_TRANSIT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'pickup_status' AND e.enumlabel = 'VEHICLE_DROPPED_AT_WORKSHOP'
  ) THEN
    ALTER TYPE pickup_status ADD VALUE 'VEHICLE_DROPPED_AT_WORKSHOP';
  END IF;
END $$;
