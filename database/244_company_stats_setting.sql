-- Company-wide stats shown on all workshop public pages
-- (Store header stats + About MyFNG section)

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES
  ('company_stats', '{
    "cars_serviced": "1 Million+",
    "happy_customers": "25 Lacs+",
    "avg_rating": "4.8",
    "touch_points": "1000+",
    "verified_workshops": "100+",
    "cities_covered": "6+",
    "about_description": "Mumbai & Pune''s Trusted Multi-Brand Car Service Network — 100+ verified workshops, AI-powered booking, and transparent service for every car owner.",
    "who_we_are_1": "MyFNG (My Friendly Neighbourhood Garage) is a network of 100+ A-Grade multi-brand car servicing workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune.",
    "who_we_are_2": "We connect car owners with professional technicians, advanced diagnostic tools, and transparent pricing — so you never overpay or worry about your car''s health again."
  }', 'JSON', 'PUBLIC_PAGE', 'Company-wide stats and numbers displayed on all workshop public pages', '{}', true)
ON CONFLICT (setting_key) DO NOTHING;
