-- ============================================
-- Periodic Service pricing WhatsApp template (UTILITY)
-- Super Admin → WhatsApp Templates → shows as local draft
-- Then: open template → Push / submit to Meta for approval
--
-- Covers Basic / General / Premium / Platinum (15 / 30 / 50 / 60 pts)
-- with Semi + Fully Synthetic price variables.
--
-- NOTE: Meta body max ~1024 chars — full 60-point checklist cannot fit
-- inside a Meta template. Detailed points still go via session text
-- (telecaller Send Pricing). This template is for cold / outside-24h send.
--
-- Run in Supabase SQL Editor, then refresh WhatsApp Templates page.
-- ============================================

BEGIN;

INSERT INTO public.whatsapp_templates (
  template_name,
  display_name,
  language_code,
  category,
  body_text,
  variable_keys,
  example_values,
  is_active,
  meta,
  created_at,
  updated_at
) VALUES (
  'periodic_service_pricing',
  'Periodic Service Pricing (Basic–Platinum)',
  'en',
  'UTILITY',
  E'Hi {{1}},\n\nSharing MyFNG Car Periodic Service pricing for {{2}} (PIN {{3}}).\n\nSemi Synthetic\n1. Basic · 15 pts · INR {{4}}\n2. General · 30 pts · INR {{5}}\n3. Premium · 50 pts · INR {{6}}\n4. Platinum · 60 pts · INR {{7}}\n\nFully Synthetic\n1. Basic · 15 pts · INR {{8}}\n2. General · 30 pts · INR {{9}}\n3. Premium · 50 pts · INR {{10}}\n4. Platinum · 60 pts · INR {{11}}\n\nPoints: Basic 1-15, General adds 16-30, Premium adds 31-50, Platinum adds 51-60. Full checklist shared after you reply.\n\nThis is an automated pricing update from MyFNG. Reply BOOK to proceed.',
  '["customer_name","car_model","pincode","semi_basic","semi_general","semi_premium","semi_platinum","full_basic","full_general","full_premium","full_platinum"]'::jsonb,
  '["Rahul","Hyundai i20","400001","2999","5000","6800","11300","3499","5800","7800","12800"]'::jsonb,
  false,
  jsonb_build_object(
    'purpose', 'telecaller_periodic_pricing',
    'source', 'local_draft',
    'meta_submit_note', 'UTILITY — Periodic Basic/General/Premium/Platinum with Semi+Fully prices. Full 60-pt checklist via session text after reply (Meta body limit).',
    'tiers', jsonb_build_array(
      jsonb_build_object('tier', 'Basic', 'points', 15),
      jsonb_build_object('tier', 'General', 'points', 30),
      jsonb_build_object('tier', 'Premium', 'points', 50),
      jsonb_build_object('tier', 'Platinum', 'points', 60)
    )
  ),
  NOW(),
  NOW()
)
ON CONFLICT (template_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  body_text = EXCLUDED.body_text,
  variable_keys = EXCLUDED.variable_keys,
  example_values = EXCLUDED.example_values,
  category = EXCLUDED.category,
  meta = EXCLUDED.meta,
  updated_at = NOW();

COMMIT;

-- Verify:
-- SELECT template_name, display_name, is_active, category,
--        jsonb_array_length(variable_keys) AS vars,
--        length(body_text) AS body_len,
--        meta->>'purpose' AS purpose
-- FROM public.whatsapp_templates
-- WHERE template_name = 'periodic_service_pricing';
