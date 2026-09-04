-- Allow delivery-assign in-app notifications.
-- Older DBs used notification_type ENUM without DELIVERY_ASSIGNED, so inserts failed silently.
-- Safe to re-run. If `notifications.type` is already TEXT/VARCHAR, these statements no-op or error
-- only when the enum type is missing — ignore that error.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'DELIVERY_ASSIGNED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'PICKUP_TASK_ASSIGNED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SYSTEM_ALERT';
