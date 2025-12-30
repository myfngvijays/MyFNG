-- =====================================================
-- SEED: public.categories
-- Notes:
-- - uuid/created_at/updated_at/status will use defaults
-- - category_images/category_icon kept NULL as requested
-- - Idempotent: re-run safe (upserts by unique category)
-- =====================================================

-- =====================================================
-- Rename legacy category names (safe/idempotent)
-- (Prevents leaving old rows like "Brake Service" behind.)
-- =====================================================
UPDATE public.categories c
SET category = 'Car Brake Service',
    updated_at = now()
WHERE c.category = 'Brake Service'
  AND NOT EXISTS (SELECT 1 FROM public.categories x WHERE x.category = 'Car Brake Service');

UPDATE public.categories c
SET category = 'Car Clutch Service',
    updated_at = now()
WHERE c.category = 'Clutch Service'
  AND NOT EXISTS (SELECT 1 FROM public.categories x WHERE x.category = 'Car Clutch Service');

UPDATE public.categories c
SET category = 'Car Detailing Service',
    updated_at = now()
WHERE c.category = 'Detailing Service'
  AND NOT EXISTS (SELECT 1 FROM public.categories x WHERE x.category = 'Car Detailing Service');

UPDATE public.categories c
SET category = 'Car Denting & Painting',
    updated_at = now()
WHERE c.category = 'Denting & Painting'
  AND NOT EXISTS (SELECT 1 FROM public.categories x WHERE x.category = 'Car Denting & Painting');

UPDATE public.categories c
SET category = 'Car Tyre & Wheel Care',
    updated_at = now()
WHERE c.category = 'Tyre & Wheel Care'
  AND NOT EXISTS (SELECT 1 FROM public.categories x WHERE x.category = 'Car Tyre & Wheel Care');

INSERT INTO public.categories (
  category,
  category_images,
  category_icon,
  description,
  sequence,
  status
) VALUES
  (
    'Car Periodic Service',
    NULL,
    NULL,
    $$Keep your car running smooth, safe, and fuel-efficient with MyFNG Car Periodic Service. We follow a standardised service process to inspect, clean, and maintain all critical components—helping prevent your car breakdowns and costly repairs.$$,
    1,
    true
  ),
  (
    'Car Engine Service',
    NULL,
    NULL,
    $$Your car's engine is its heart. MyFNG Car Engine Service ensures smooth performance, better mileage, and long engine life by thoroughly inspecting, cleaning, and tuning critical engine components. We identify early warning signs, prevent major failures, and help you avoid expensive engine repairs through a standardised, expert-led service process.$$,
    2,
    true
  ),
  (
    'Car AC Service',
    NULL,
    NULL,
    $$Beat the heat with MyFNG Car AC Service, designed to deliver faster cooling, cleaner air, and consistent performance. We inspect, clean, and optimise your car's AC system to prevent weak cooling, bad odour, and sudden AC failures.$$,
    3,
    true
  ),
  (
    'Car Battery Service',
    NULL,
    NULL,
    $$Avoid sudden breakdowns with MyFNG Car Battery Service, designed to keep your car starting reliably every time. We test, inspect, and optimise your battery and charging system to ensure consistent power and longer battery life.$$,
    4,
    true
  ),
  (
    'Car Brake Service',
    NULL,
    NULL,
    $$Your car's safety depends on its brakes. MyFNG Car Brake Service ensures responsive braking, reduced stopping distance, and complete driving confidence through detailed inspection, cleaning, and precise adjustments. We identify early brake wear and fix issues before they turn into expensive or dangerous failures.$$,
    5,
    true
  ),
  (
    'Car Tyre & Wheel Care',
    NULL,
    NULL,
    $$Safe handling and smooth rides start with healthy tyres and well-aligned wheels. MyFNG Car Tyre & Wheel Care service improves road grip, steering control, and tyre life through precise inspection and corrective maintenance. We help prevent uneven tyre wear, vibrations, and poor fuel efficiency with a standardised care process.$$,
    6,
    true
  ),
  (
    'Car Detailing Service',
    NULL,
    NULL,
    $$A clean car isn’t just about looks—it’s about comfort, hygiene, and safety. MyFNG Car Detailing Service deep-cleans, restores, and protects your car’s interior and exterior, helping maintain visibility, air quality, and long-term value. We use professional-grade products and a standardised detailing process to give your car a fresh, showroom-like finish.$$,
    7,
    true
  ),
  (
    'Car Denting & Painting',
    NULL,
    NULL,
    $$Dents and scratches don’t just spoil your car’s look—they can weaken body panels and lead to rust over time. MyFNG Car Denting & Painting service restores your car’s body strength, paint finish, and resale value using professional repair and paint-matching techniques. We ensure precise dent removal and a smooth, factory-like paint finish through a standardised repair process.$$,
    8,
    true
  ),
  (
    'Car Clutch Service',
    NULL,
    NULL,
    $$A healthy clutch ensures smooth gear shifts and comfortable driving. MyFNG Car Clutch Service diagnoses wear and performance issues early to prevent breakdowns, jerks, and costly transmission damage. We inspect, adjust, and service clutch components using a standardised process for reliable performance and longer clutch life.$$,
    9,
    true
  )
ON CONFLICT (category) DO UPDATE SET
  description = EXCLUDED.description,
  sequence = EXCLUDED.sequence,
  status = EXCLUDED.status,
  updated_at = now();


