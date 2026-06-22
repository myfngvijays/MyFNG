-- Set claim limits for quota-based Prime membership benefits
UPDATE public.membership_benefits
SET max_usage = 2
WHERE benefit_code IN ('FREE_INSPECTION', 'FREE_SCAN')
  AND (max_usage IS NULL OR max_usage = 0);

COMMENT ON COLUMN public.membership_benefits.max_usage IS 'Max times benefit can be claimed per membership period; NULL = unlimited';
