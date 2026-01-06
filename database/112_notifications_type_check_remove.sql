-- Allow storing full notification event types (e.g. PICKUP_TASK_ASSIGNED, QC_FAILED, etc.)
-- Older schema constrained `notifications.type` to INFO/SUCCESS/WARNING/ERROR which breaks the final system.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;


