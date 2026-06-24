-- Migration 214: Backfill health report customer + platform from saved vehicles

UPDATE public.vehicle_health_reports r
SET
  customer_id = c.id,
  customer_name = COALESCE(r.customer_name, c.full_name),
  customer_phone = COALESCE(r.customer_phone, c.phone),
  platform = COALESCE(r.platform, NULLIF(c.app_platform, ''))
FROM public.customer_vehicles v
JOIN public.customers c ON c.id = v.customer_id
WHERE upper(replace(replace(r.reg_number, ' ', ''), '-', '')) = upper(replace(replace(v.vehicle_number, ' ', ''), '-', ''))
  AND (r.customer_id IS NULL OR r.customer_name IS NULL OR r.customer_phone IS NULL OR r.platform IS NULL);
