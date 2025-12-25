-- Seed manual FAQs into public.kb_manual_faqs from the provided Excel sheet
-- How to run:
-- 1) Run database/kb_manual_faqs_setup.sql (if not already)
-- 2) Run THIS file in Supabase SQL Editor
-- 3) Run kb-ingest for table source "table:kb_manual_faqs_active" to chunk+embed for RAG

insert into public.kb_manual_faqs (question, answer, is_active, updated_at)
values
  (
    'General: What is MY FNG?',
    'MY FNG is Mumbai''s most trusted multi-brand car service platform. We connect car owners with 50+ A-grade workshops in Mumbai, Thane, Navi Mumbai, and Palghar.',
    true,
    now()
  ),
  (
    'General: Why should I choose MY FNG instead of my local garage?',
    'With MY FNG you get:\n- Free pickup & drop\n- OEM/OES genuine spare parts\n- Photo/video proof\n- 50-point checkup\n- 1-month / 1,000 km warranty\n- Same-day service\n\nLocal garages may not offer this level of transparency and guarantee.',
    true,
    now()
  ),
  (
    'General: Do you provide doorstep service?',
    'We provide free pickup & drop. Service is done at our partner workshops with proper equipment.',
    true,
    now()
  ),
  (
    'General: How do I book service?',
    'Just share your car details and preferred date. We''ll arrange a callback from our expert to confirm pickup.',
    true,
    now()
  ),
  (
    'General: Can I get service today?',
    'Yes, in most areas we provide same-day pickup & service.',
    true,
    now()
  ),
  (
    'General: Is it safe to give my car to you?',
    'Absolutely. Driver takes pre-inspection photos, you get updates throughout, and you''re covered with warranty.',
    true,
    now()
  ),
  (
    'Services: What services do you provide?',
    'We provide:\n- Regular car servicing (basic/standard/premium)\n- Repairs (engine, brakes, clutch, AC, suspension)\n- Cleaning & detailing\n- Car scanning & diagnostics',
    true,
    now()
  ),
  (
    'Services: Can you handle my car model?',
    'Yes. We service all car models with expert mechanics.',
    true,
    now()
  ),
  (
    'Services: Do you do repairs also?',
    'Yes. From engine & clutch to AC, suspension, brakes — we handle all repairs with OEM/OES parts.',
    true,
    now()
  ),
  (
    'Services: What service plans do you offer?',
    'We have 3 plans: General, Premium, and Platinum:\n\n- General: 30-point (engine oil, oil filter, brake service, tuning, top-ups)\n- Premium: 50-point (General + AC filter, air filter, scanning, preventive maintenance, health report)\n- Platinum: Full synthetic oil + premium add-ons\n\nExact pricing depends on car model; shared by service expert.',
    true,
    now()
  ),
  (
    'Services: CNG service available hai kya?',
    'CNG service certified CNG fitment centers mein hoti hai. Hum aapko recommend/assist kar sakte hain.',
    true,
    now()
  ),
  (
    'Services: System mein ek hi car hai, second car ka kya plan hai?',
    'Sir, hum aapki second car ko system mein add kar dete hain aur uske packages ka PDF bhej dete hain.',
    true,
    now()
  ),
  (
    'Repairs: My service is not due, but I have an issue in my car. Can you help?',
    'Yes. MY FNG also handles custom repairs. Our partner workshop will pick up your car, inspect it, and share an estimate. If you don''t go ahead, only Pickup/Drop/Inspection/Estimate charges apply: 999 (Hatchbacks/Sedans) or 1,299 (SUVs/MUVs).',
    true,
    now()
  ),
  (
    'Repairs: What kind of car issues can you fix?',
    'We handle all problems — clutch hard, brake noise, suspension, AC cooling, steering, vibration, starting issues, overheating, fuel average drop, window issues, etc.',
    true,
    now()
  ),
  (
    'Repairs: Do you also do denting and painting?',
    'Yes. Denting & painting starts from 3,500 per panel (solid color). Metallic, pearl, or SUV/MUV panels cost more. Final estimate after inspection.',
    true,
    now()
  ),
  (
    'Repairs: What happens if I only want scanning or inspection?',
    'We provide complete scanning & 50-point health reports. If only inspection is done, Pickup/Drop/Inspection charges apply (999 hatchbacks/sedans, 1,299 SUVs/MUVs).',
    true,
    now()
  ),
  (
    'Repairs: Clutch plate ka cost aur labour charges kya hai?',
    'Sir, cost car model pe depend karta hai. Aap model bataiye, hum parts & labour breakup bhej dete hain via expert call.',
    true,
    now()
  ),
  (
    'Process: How does the service process work?',
    '1) Free pickup\n2) Pre-inspection photos\n3) Estimate approval\n4) Service/repairs with proof\n5) Car delivered back with warranty',
    true,
    now()
  ),
  (
    'Process: How will I know what work is done?',
    'You''ll get photos & videos of all major work (oil change, parts replacement, washing, etc.).',
    true,
    now()
  ),
  (
    'Process: How long does the service take?',
    'Most cars are completed the same day. Major repairs may take longer.',
    true,
    now()
  ),
  (
    'Trust & Warranty: Do you give warranty?',
    'Yes, every service comes with a 1-month or 1,000 km warranty.',
    true,
    now()
  ),
  (
    'Trust & Warranty: What if I face issues after service?',
    'Don''t worry — we''ll resolve it under warranty.',
    true,
    now()
  ),
  (
    'Trust & Warranty: How do I know parts are genuine?',
    'We only use OEM/OES genuine parts and share photo/video proof.',
    true,
    now()
  ),
  (
    'Trust & Warranty: Authorized jaisa record milega kya?',
    'Yes. Aapko proper GST invoice and digital record milta hai.',
    true,
    now()
  ),
  (
    'Trust & Warranty: Aap spare parts ke sath chedchad karte ho?',
    'Bilkul nahi sir. Aapko har kaam ka photo/video proof milta hai. Hum trust aur transparency ke liye known hain (Google rating 4.2).',
    true,
    now()
  ),
  (
    'Trust & Warranty: Dent & paint pe warranty kya milta hai?',
    'Dent & paint service pe 1-yr warranty hoti hai against paint chipping, peeling, or fading. We use top-grade materials.',
    true,
    now()
  ),
  (
    'Objections: Mujhe address do, main kabhi aa jaunga.',
    'Sir, hamare workshops strictly appointment-based hain. Walk-in vehicles bina booking ke accept nahi hote. Aap slot batayein, hum confirm kar denge aur ek din pehle reminder bhejenge.',
    true,
    now()
  ),
  (
    'Objections: Aapka price aur authorized ka price same hai, toh difference kya hai?',
    'Even if price matches, MY FNG gives:\n- Full transparency (photos/videos)\n- Free pickup/drop\n- Warranty (1 month/1,000 km)\n- Same-day delivery\n- Free mini service within 6 months (inspection + oil/consumables top-up)\n\nAuthorized/local workshops don''t provide this.',
    true,
    now()
  ),
  (
    'Objections: Workshop aapka khud ka hai ya tie-up hai?',
    'Workshops humare tie-up partners hain, sab A-grade verified. Direct jaane se price same ya zyada hi hota hai. MY FNG aapko deta hai bulk-negotiated rates, free pickup/drop, real-time updates, warranty, transparency.',
    true,
    now()
  ),
  (
    'Objections: Same rate mein dusra workshop de raha hai, toh aapse kyun karu?',
    'Fair question. MY FNG gives transparency, photos/videos, real-time updates, warranty, and a free mini service within 6 months. Dusra workshop yeh sab nahi deta.',
    true,
    now()
  ),
  (
    'Objections: Aapke package mein wheel alignment/balancing nahi hai.',
    'Sir, wheel alignment/balancing har service mein mandatory nahi hota. Agar inspection mein zarurat lage toh hum add karte hain at nominal cost.',
    true,
    now()
  ),
  (
    'Commercial: Yeh package mein GST included hai kya?',
    'Yes. Package prices are inclusive of GST. Aapko proper GST invoice milega.',
    true,
    now()
  ),
  (
    'Commercial: AMC package hai kya?',
    'Yes. We have Annual Maintenance Contracts with multiple services, priority slots, and savings.',
    true,
    now()
  ),
  (
    'Commercial: Do you have any offers?',
    'Yes. We sometimes provide free car scanning or free Teflon coating with a 50-point report (on selected packages). Our service expert will confirm if any current offer is available.',
    true,
    now()
  ),
  (
    'Fallback: Can you tell me the price?',
    'Our service expert will share the exact pricing for your car model during the callback.',
    true,
    now()
  ),
  (
    'Fallback: Can you share the workshop address?',
    'Pickup & drop is free. Our service expert will confirm the workshop location when they call you.',
    true,
    now()
  ),
  (
    'Fallback: Mere vehicle ke liye cost aur workshop details do.',
    'Sir, aapki car model confirm karke hum nearest workshop & exact package price callback mein share karenge.',
    true,
    now()
  )
on conflict (question)
do update set
  answer = excluded.answer,
  is_active = true,
  updated_at = now();


