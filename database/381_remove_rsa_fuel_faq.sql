-- Fuel delivery is no longer an RSA service. Hide the public FAQ that still offers it.
UPDATE public.public_faqs
SET active = FALSE, visible_web = FALSE, visible_app = FALSE
WHERE faq_group = 'RSA'
  AND question ILIKE '%fuel delivery%';
