-- 116_notification_logs_service_role_grant.sql
-- Ensure service role (used by admin API routes) can read/write push history logs.

GRANT ALL ON public.notification_logs TO service_role;
