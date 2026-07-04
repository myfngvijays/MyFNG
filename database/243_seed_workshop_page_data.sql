-- ================================================================
-- SEED DEFAULT DATA FOR ACTIVE WORKSHOP PUBLIC PAGES
-- Fills brands, packages, FAQs, and services for published pages
-- ================================================================

-- Update ALL published workshop pages with default brands (if empty)
UPDATE public.workshop_public_pages
SET brands = '[
  {"name": "Maruti Suzuki", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Maruti_Suzuki_Logo.svg/200px-Maruti_Suzuki_Logo.svg.png"},
  {"name": "Hyundai", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Hyundai_Motor_Company_logo.svg/200px-Hyundai_Motor_Company_logo.svg.png"},
  {"name": "Tata Motors", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Tata_logo.svg/200px-Tata_logo.svg.png"},
  {"name": "Honda", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Honda_logo2.svg/200px-Honda_logo2.svg.png"},
  {"name": "Toyota", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/200px-Toyota.svg.png"},
  {"name": "Mahindra", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Mahindra_%26_Mahindra_Logo.svg/200px-Mahindra_%26_Mahindra_Logo.svg.png"},
  {"name": "Kia", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia-logo.png/200px-Kia-logo.png"},
  {"name": "MG Motor", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/MG_Motor_new_logo.png/200px-MG_Motor_new_logo.png"},
  {"name": "Volkswagen", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/200px-Volkswagen_logo_2019.svg.png"},
  {"name": "Skoda", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/%C5%A0koda_Auto_2016.svg/200px-%C5%A0koda_Auto_2016.svg.png"},
  {"name": "Ford", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Ford_Motor_Company_Logo.svg/200px-Ford_Motor_Company_Logo.svg.png"},
  {"name": "Renault", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Renault_2021_Text.svg/200px-Renault_2021_Text.svg.png"}
]'::jsonb
WHERE is_published = true
  AND (brands IS NULL OR brands = '[]'::jsonb);

-- Update ALL published workshop pages with default packages (if empty)
UPDATE public.workshop_public_pages
SET packages = '[
  {
    "name": "Basic Service",
    "price": "₹2,999",
    "features": [
      "Engine Oil Replacement",
      "Oil Filter Replacement",
      "Air Filter Cleaning",
      "Spark Plugs Servicing",
      "Interior Vacuuming & Body Wash"
    ]
  },
  {
    "name": "General Service",
    "price": "₹5,000",
    "features": [
      "Everything in Basic +",
      "Brake Pads & Fluid Check",
      "Battery Terminal Cleaning",
      "AC Performance Check",
      "Test Drive & Final Inspection"
    ]
  },
  {
    "name": "Premium Service",
    "price": "₹6,800",
    "features": [
      "Everything in General +",
      "All Brake Cleaning & Lubrication",
      "AC Disinfectant Spray",
      "Tyre Rotation & Torque",
      "Diagnostics Scan & Report"
    ]
  },
  {
    "name": "Platinum Service",
    "price": "₹11,300",
    "features": [
      "Everything in Premium +",
      "Engine Compression Test",
      "Throttle Body & EGR Cleaning",
      "Interior Deep Cleaning",
      "Paint Protection & Underbody Coating"
    ]
  }
]'::jsonb
WHERE is_published = true
  AND (packages IS NULL OR packages = '[]'::jsonb);

-- Update ALL published workshop pages with default FAQs (if empty)
UPDATE public.workshop_public_pages
SET faqs = '[
  {
    "question": "What is My FNG – Car Garage & Repairs?",
    "answer": "My FNG (Friendly Neighbourhood Garage) is a trusted network of 100+ A-Grade multi-brand car servicing and repair workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune. Our car service center offers professional, transparent, and high-quality car servicing and repairs for local car owners."
  },
  {
    "question": "What brands of cars do you service?",
    "answer": "We service all major car brands and models, including hatchbacks, sedans, SUVs, and premium cars. Our technicians are trained to work on both petrol and diesel cars."
  },
  {
    "question": "How can I find a My FNG car service center near me?",
    "answer": "You can locate the nearest My FNG car service center by visiting www.myfng.in. You may also contact our customer support team for location details and booking assistance."
  },
  {
    "question": "What car services are offered?",
    "answer": "We provide a full range of car services including basic & general car service, periodic maintenance, oil changes, brake inspection & repairs, engine diagnostics & repairs, tyre services, car AC service & gas refill, battery replacement, suspension & steering work, and mechanical & electrical repairs."
  },
  {
    "question": "How can I book a car service appointment?",
    "answer": "You can book an AI-enabled car service appointment online via www.myfng.in or by calling our customer support team. We offer flexible appointment scheduling."
  },
  {
    "question": "Are the technicians certified?",
    "answer": "Yes. All technicians at My FNG are trained, experienced, and certified. They regularly undergo skill upgrades and use advanced diagnostic tools."
  },
  {
    "question": "Do you use genuine parts for car repairs and servicing?",
    "answer": "Yes. My FNG uses only genuine and high-quality car parts for all repairs to ensure safety, performance, and long-term reliability."
  },
  {
    "question": "Is there a warranty on services provided?",
    "answer": "Yes. My FNG offers service and parts warranty. Warranty terms vary based on service performed. Visit www.myfng.in or contact support for details."
  },
  {
    "question": "How do I know if my car needs servicing?",
    "answer": "Look for dashboard warning lights, unusual engine or brake noises, reduced fuel efficiency, poor driving performance, or delayed braking response. A basic car service is recommended every 5,000 km or 6 months."
  },
  {
    "question": "How can I contact My FNG for more questions?",
    "answer": "Visit www.myfng.in or call our customer support team. We are always ready to assist you."
  }
]'::jsonb
WHERE is_published = true
  AND (faqs IS NULL OR faqs = '[]'::jsonb);

-- Update ALL published workshop pages with default services (if empty)
UPDATE public.workshop_public_pages
SET services_offered = '[
  "Auto Repair",
  "Vehicle Repair",
  "Periodic Service",
  "Car Engine Repairs",
  "Car AC Service",
  "Car Battery Service",
  "Car Brake Service",
  "Car Clutch Service",
  "Tyre & Wheel Care",
  "Car Detailing",
  "Denting & Painting",
  "Electrical & Battery",
  "Suspension & Steering",
  "Roadside Assistance",
  "Car Garage",
  "Multibrand Workshop",
  "Car Service Center"
]'::jsonb
WHERE is_published = true
  AND (services_offered IS NULL OR services_offered = '[]'::jsonb);
