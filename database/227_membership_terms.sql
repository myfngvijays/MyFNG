-- Admin-managed Terms & Conditions for RSA and MyFNG Prime (SERVICE) memberships
CREATE TABLE IF NOT EXISTS public.membership_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_type VARCHAR(20) NOT NULL CHECK (membership_type IN ('RSA', 'SERVICE')),
  body TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_terms_type_order
  ON public.membership_terms (membership_type, display_order, created_at);

COMMENT ON TABLE public.membership_terms IS 'Bullet-point T&C shown on RSA screen, Prime membership page, and website RSA landing';

-- Default RSA membership terms
INSERT INTO public.membership_terms (membership_type, body, display_order, active)
SELECT v.membership_type, v.body, v.display_order, TRUE
FROM (
  VALUES
    ('RSA'::VARCHAR, 'Members are entitled to 2 free RSA services per year under all plans, excluding the Premium Plan.', 1),
    ('RSA', 'Towing distance is calculated on a round-trip basis (from the service provider''s location to the vehicle''s location and then to the destination).', 2),
    ('RSA', 'Key Unlock Assistance is subject to the type of lock system used in the vehicle.', 3),
    ('RSA', 'On-Spot Minor Repairs are limited to small fixes that can be completed without requiring extensive tools or garage equipment.', 4),
    ('RSA', 'Hotel accommodation is subject to availability and limited to one night.', 5),
    ('RSA', 'Cab arrangement is limited to 50 km and additional charges may apply for distances exceeding this limit.', 6),
    ('RSA', 'Ambulance service is provided in case of accidents only and is subject to availability.', 7)
) AS v(membership_type, body, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.membership_terms t WHERE t.membership_type = 'RSA'
);

-- Default MyFNG Prime (SERVICE) membership terms — based on plan benefit points
INSERT INTO public.membership_terms (membership_type, body, display_order, active)
SELECT v.membership_type, v.body, v.display_order, TRUE
FROM (
  VALUES
    ('SERVICE'::VARCHAR, 'Membership is valid for 12 months from the date of activation.', 1),
    ('SERVICE', '10% off on periodic service packages applies at checkout, subject to the benefit cap shown on your plan.', 2),
    ('SERVICE', '5% cashback is auto-credited to your MyFNG wallet within 48 hours of eligible service completion.', 3),
    ('SERVICE', 'Free top-up & inspection and free car scanning are limited to 2 visits each per membership year.', 4),
    ('SERVICE', 'Free insurance claim assistance covers assessment, documentation and claim support only.', 5),
    ('SERVICE', 'Prime personal WhatsApp group access is activated within 24 hours of membership purchase.', 6),
    ('SERVICE', 'Priority slot booking gives preferential workshop slots subject to availability.', 7),
    ('SERVICE', '6-month extended warranty applies on eligible services completed during active membership.', 8),
    ('SERVICE', 'Free pickup & drop is included on eligible periodic services during active membership.', 9),
    ('SERVICE', '2nd car add-on (if purchased) shares the same validity period as your primary car membership.', 10),
    ('SERVICE', 'Membership is non-transferable and linked to your verified mobile number.', 11)
) AS v(membership_type, body, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.membership_terms t WHERE t.membership_type = 'SERVICE'
);
