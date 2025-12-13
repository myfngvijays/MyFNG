-- =====================================================
-- Create customer-facing service checklist templates
-- Purpose: Enable /book-service to show “Show more” checklist automatically
-- Notes:
-- - This is NOT lead-specific (unlike service_checklists).
-- - Add a row for any service_type that should show a checklist to customers.
-- - UI will automatically show “Show more” when a template exists.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.service_type_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  title text,
  points integer,
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(service_type_id)
);

ALTER TABLE public.service_type_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Public read (website pages)
DROP POLICY IF EXISTS "Public can read service checklist templates" ON public.service_type_checklist_templates;
CREATE POLICY "Public can read service checklist templates" ON public.service_type_checklist_templates
FOR SELECT
USING (true);

-- Admin manage
DROP POLICY IF EXISTS "Super admins can manage service checklist templates" ON public.service_type_checklist_templates;
CREATE POLICY "Super admins can manage service checklist templates" ON public.service_type_checklist_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
  )
);

-- Optional seed examples (safe: only inserts when matching service_types exist)
-- You can add more templates later; UI will pick them up automatically.
DO $$
DECLARE
  st_id uuid;
BEGIN
  -- Basic Service (15 Points)
  SELECT id INTO st_id FROM public.service_types WHERE UPPER(name) LIKE '%BASIC%15%POINT%' LIMIT 1;
  IF st_id IS NOT NULL THEN
    INSERT INTO public.service_type_checklist_templates(service_type_id, title, points, checklist_items)
    VALUES (
      st_id,
      'Basic Service (15 Points) – What we will do',
      15,
      '[
        {"id":"1","name":"Clean Air Filter","category":"Engine Compartment"},
        {"id":"2","name":"Spark Plugs Servicing","category":"Engine Compartment"},
        {"id":"3","name":"Top up Brake Oil","category":"Engine Compartment"},
        {"id":"4","name":"Top up Gear Oil","category":"Engine Compartment"},
        {"id":"5","name":"Top up Power Steering Oil & Clutch Oil (If applicable)","category":"Engine Compartment"},
        {"id":"6","name":"Top up Coolant","category":"Engine Compartment"},
        {"id":"7","name":"Top up Battery Water","category":"Engine Compartment"},
        {"id":"8","name":"Top up Wiper Water Tank","category":"Engine Compartment"},
        {"id":"9","name":"Replace Oil Filter","category":"Engine Compartment"},
        {"id":"10","name":"Replace Engine Oil","category":"Engine Compartment"},
        {"id":"11","name":"Clean Cabin AC Filter","category":"Cabin"},
        {"id":"12","name":"Interior Vacuuming","category":"Cabin"},
        {"id":"13","name":"Grease Door Hinges","category":"Cabin"},
        {"id":"14","name":"Inspect & Top up Tyre Pressure","category":"Others"},
        {"id":"15","name":"Body Wash","category":"Others"}
      ]'::jsonb
    )
    ON CONFLICT (service_type_id) DO NOTHING;
  END IF;
END $$;
