-- Mark Meta-approved periodic_service_pricing template as active
UPDATE public.whatsapp_templates
SET
  is_active = true,
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
    'source', 'meta_approved',
    'meta_status', 'APPROVED',
    'approved_note', 'Meta approved — used by telecaller Send Pricing'
  ),
  updated_at = NOW()
WHERE template_name = 'periodic_service_pricing';
