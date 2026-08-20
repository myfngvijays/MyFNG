-- Backfill existing MISA OTP leads: channel-specific last_call_label + CRM child tags.
-- Tags alone do NOT segregate leads — this rewrites coupon_meta + tag map for old rows.
-- Safe to re-run. Requires 327_crm_lead_tags_misa_otp_channels.sql first.

-- 1) Infer misa_channel + last_call_label on incomplete / OTP MISA leads
WITH classified AS (
  SELECT
    sl.id,
    CASE
      WHEN upper(btrim(COALESCE(sl.coupon_meta->>'misa_channel', ''))) IN ('WHATSAPP', 'WEBSITE', 'APP')
        THEN upper(btrim(sl.coupon_meta->>'misa_channel'))
      WHEN lower(COALESCE(sl.lead_source, '') || ' ' || COALESCE(sl.coupon_meta->>'last_call_label', '') || ' ' || COALESCE(sl.description, ''))
           ~ 'whatsapp'
        OR upper(btrim(COALESCE(sl.created_from, ''))) = 'WHATSAPP'
        THEN 'WHATSAPP'
      WHEN lower(COALESCE(sl.lead_source, '')) ~ 'misa ai \(app\)'
        OR lower(COALESCE(sl.coupon_meta->>'last_call_label', '')) LIKE '%misa otp · app%'
        OR upper(btrim(COALESCE(sl.created_from, ''))) IN ('APP', 'MOBILE_APP', 'MOBILE')
        THEN 'APP'
      ELSE 'WEBSITE'
    END AS misa_ch
  FROM public.service_leads sl
  WHERE sl.deleted_at IS NULL
    AND (
      (sl.coupon_meta->>'misa_otp_verified') IN ('true', 't', '1')
      OR lower(COALESCE(sl.coupon_meta->>'last_call_label', '')) LIKE '%misa otp%'
      OR (
        upper(COALESCE(sl.coupon_meta->>'last_call_result', '')) = 'OTP_VERIFIED'
        AND lower(COALESCE(sl.lead_source, '')) LIKE '%misa%'
      )
    )
)
UPDATE public.service_leads sl
SET
  coupon_meta =
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(sl.coupon_meta, '{}'::jsonb),
          '{misa_otp_verified}',
          'true'::jsonb,
          true
        ),
        '{misa_channel}',
        to_jsonb(c.misa_ch),
        true
      ),
      '{last_call_label}',
      to_jsonb(
        CASE c.misa_ch
          WHEN 'WHATSAPP' THEN 'MISA OTP · WhatsApp'
          WHEN 'APP' THEN 'MISA OTP · App'
          ELSE 'MISA OTP · Website'
        END
      ),
      true
    ),
  updated_at = now()
FROM classified c
WHERE sl.id = c.id
  AND (
    COALESCE(sl.coupon_meta->>'last_call_label', '') IS DISTINCT FROM
      CASE c.misa_ch
        WHEN 'WHATSAPP' THEN 'MISA OTP · WhatsApp'
        WHEN 'APP' THEN 'MISA OTP · App'
        ELSE 'MISA OTP · Website'
      END
    OR COALESCE(sl.coupon_meta->>'misa_channel', '') IS DISTINCT FROM c.misa_ch
  );

-- 2) Attach parent + channel child CRM tags (PK = lead_id, tag_id)
WITH parent AS (
  SELECT id FROM public.crm_lead_tags
  WHERE lower(btrim(name)) = 'misa otp verified'
  LIMIT 1
),
children AS (
  SELECT
    id,
    CASE lower(btrim(name))
      WHEN 'misa otp · whatsapp' THEN 'WHATSAPP'
      WHEN 'misa otp · app' THEN 'APP'
      WHEN 'misa otp · website' THEN 'WEBSITE'
      ELSE NULL
    END AS misa_ch
  FROM public.crm_lead_tags
  WHERE lower(btrim(name)) IN (
    'misa otp · whatsapp',
    'misa otp · website',
    'misa otp · app'
  )
),
targets AS (
  SELECT
    sl.id AS lead_id,
    upper(btrim(COALESCE(sl.coupon_meta->>'misa_channel', 'WEBSITE'))) AS misa_ch
  FROM public.service_leads sl
  WHERE sl.deleted_at IS NULL
    AND (
      (sl.coupon_meta->>'misa_otp_verified') IN ('true', 't', '1')
      OR lower(COALESCE(sl.coupon_meta->>'last_call_label', '')) LIKE 'misa otp ·%'
    )
)
INSERT INTO public.crm_lead_tag_map (lead_id, tag_id)
SELECT t.lead_id, x.tag_id
FROM targets t
CROSS JOIN LATERAL (
  SELECT parent.id AS tag_id FROM parent
  UNION
  SELECT c.id FROM children c WHERE c.misa_ch = t.misa_ch
) x
WHERE x.tag_id IS NOT NULL
ON CONFLICT (lead_id, tag_id) DO NOTHING;
