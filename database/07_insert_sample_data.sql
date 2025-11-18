-- =====================================================
-- MIGRATION: Insert Sample Data for Testing
-- Purpose: Add call scripts, roles, and sample configuration
-- =====================================================

-- =====================================================
-- Step 1: Insert Telecaller Call Scripts
-- =====================================================
INSERT INTO public.telecaller_scripts (script_type, script_title, script_content, language, category, is_active) VALUES
  (
    'OPENING',
    'Standard Opening Script',
    'Hello sir/madam, thank you for contacting MYFNG. I''m calling regarding your vehicle service request. May I confirm your car model and service requirement?',
    'en',
    'GREETING',
    true
  ),
  (
    'OPENING',
    'Hindi Opening Script',
    'Namaste sir/madam, MYFNG se bol raha/rahi hoon. Aapki gaadi ki service ke baare mein baat karni thi. Aap apni car ka model aur service requirement bata sakte hain?',
    'hi',
    'GREETING',
    true
  ),
  (
    'PICKUP_CONFIRMATION',
    'Pickup Offer Script',
    'Would you like us to pick up your vehicle from your location? It''s free within your area.',
    'en',
    'INFORMATION_GATHERING',
    true
  ),
  (
    'PICKUP_CONFIRMATION',
    'Hindi Pickup Script',
    'Kya aap chahenge ki hum aapki gaadi aapke location se pickup kar lein? Yeh service bilkul free hai aapke area mein.',
    'hi',
    'INFORMATION_GATHERING',
    true
  ),
  (
    'SLOT_SUGGESTION',
    'Slot Booking Script',
    'We have availability at 10 AM and 3 PM tomorrow. Which slot would you prefer?',
    'en',
    'INFORMATION_GATHERING',
    true
  ),
  (
    'SLOT_SUGGESTION',
    'Hindi Slot Script',
    'Hamare paas kal subah 10 baje aur dopahar 3 baje ki availability hai. Aapko kaun sa slot theek rahega?',
    'hi',
    'INFORMATION_GATHERING',
    true
  ),
  (
    'CLOSING',
    'Booking Confirmation Script',
    'Your booking is confirmed. You will receive an SMS shortly with your lead ID. Our workshop will contact you soon. Is there anything else I can help you with?',
    'en',
    'CLOSING',
    true
  ),
  (
    'CLOSING',
    'Hindi Closing Script',
    'Aapki booking confirm ho gayi hai. Aapko thodi der mein SMS milega lead ID ke saath. Hamari workshop aapse jaldi contact karegi. Kya aur kuch help chahiye?',
    'hi',
    'CLOSING',
    true
  ),
  (
    'FOLLOW_UP',
    'Follow-up Call Script',
    'Hello sir/madam, I''m calling from MYFNG regarding your previous inquiry for [SERVICE] for your [CAR MODEL]. Are you still interested in booking the service?',
    'en',
    'FOLLOW_UP',
    true
  ),
  (
    'FOLLOW_UP',
    'Hindi Follow-up Script',
    'Hello sir/madam, main MYFNG se bol raha/rahi hoon. Aapne pehle [SERVICE] ke liye [CAR MODEL] ki inquiry ki thi. Kya aap abhi bhi service book karna chahenge?',
    'hi',
    'FOLLOW_UP',
    true
  ),
  (
    'REJECTION_HANDLING',
    'Customer Rejection Response',
    'I understand. May I know the reason so we can improve our service? Thank you for considering MYFNG. Feel free to contact us anytime in the future.',
    'en',
    'OBJECTION_HANDLING',
    true
  ),
  (
    'REJECTION_HANDLING',
    'Hindi Rejection Response',
    'Main samajh sakta/sakti hoon. Kya aap bata sakte hain ki kya reason hai? Hum apni service improve kar sakte hain. MYFNG ko consider karne ke liye dhanyavaad. Aap kabhi bhi humse contact kar sakte hain.',
    'hi',
    'OBJECTION_HANDLING',
    true
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- Step 2: Ensure TELECALLER role exists
-- =====================================================
INSERT INTO public.roles (role_code, role_name, description, is_active) VALUES
  ('TELECALLER', 'Telecaller', 'Customer service representative who handles incoming calls and creates leads', true)
ON CONFLICT (role_code) DO NOTHING;

-- =====================================================
-- Step 3: Update role permissions (if needed)
-- =====================================================
UPDATE public.roles 
SET permissions = jsonb_build_object(
  'leads', jsonb_build_object(
    'create', true,
    'read', true,
    'update', true,
    'delete', false
  ),
  'calls', jsonb_build_object(
    'log', true,
    'view_own', true,
    'view_all', false
  ),
  'followups', jsonb_build_object(
    'create', true,
    'manage_own', true,
    'manage_all', false
  ),
  'customers', jsonb_build_object(
    'view', true,
    'edit', true
  ),
  'workshops', jsonb_build_object(
    'view', true,
    'edit', false
  )
)
WHERE role_code = 'TELECALLER';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Sample data inserted successfully!';
  RAISE NOTICE '📋 Added 12 call scripts (English + Hindi)';
  RAISE NOTICE '👤 TELECALLER role configured with permissions';
END $$;

