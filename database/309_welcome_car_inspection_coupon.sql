-- Special Welcome: private Car Inspection ₹1000 coupon (My Coupons only for assigned phones)
-- is_public = false → not listed for all users; only customer_coupon_assignments recipients see it.

INSERT INTO public.system_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  description,
  default_value,
  is_editable
)
VALUES (
  'wallet_welcome_bonus_auto_coupon_id',
  '',
  'STRING',
  'WALLET',
  'Coupon UUID auto-assigned to customers on the welcome bonus phone-override list (appears in My Coupons).',
  '',
  true
)
ON CONFLICT (setting_key) DO NOTHING;

DO $$
DECLARE
  v_coupon_id UUID;
  v_existing_setting TEXT;
BEGIN
  SELECT id INTO v_coupon_id
  FROM public.coupons
  WHERE LOWER(code) = LOWER('WELCOME_CI1000')
  LIMIT 1;

  IF v_coupon_id IS NULL THEN
    INSERT INTO public.coupons (
      code,
      coupon_kind,
      discount_mode,
      discount_value,
      min_order_value,
      target_custom_label,
      description,
      campaign_name,
      coupon_type_slug,
      is_public,
      is_active,
      usage_limit_per_customer,
      applicable_channels,
      start_at,
      end_at
    )
    VALUES (
      'WELCOME_CI1000',
      'TOTAL_DISCOUNT',
      'AMOUNT',
      1000,
      0,
      'Car Inspection',
      'Car Inspection worth ₹1000 — Special Welcome Bonus (valid 90 days from each user install/login)',
      'Special Welcome Bonus',
      'welcome_special',
      false,
      true,
      1,
      '["ANDROID","IOS","WEB","MOBILE"]'::jsonb,
      now(),
      NULL
    )
    RETURNING id INTO v_coupon_id;
  ELSE
    UPDATE public.coupons
    SET
      is_public = false,
      is_active = true,
      coupon_kind = 'TOTAL_DISCOUNT',
      discount_mode = 'AMOUNT',
      discount_value = 1000,
      target_custom_label = COALESCE(NULLIF(target_custom_label, ''), 'Car Inspection'),
      description = COALESCE(
        NULLIF(description, ''),
        'Car Inspection worth ₹1000 — Special Welcome Bonus (valid 90 days from each user install/login)'
      ),
      campaign_name = COALESCE(NULLIF(campaign_name, ''), 'Special Welcome Bonus'),
      coupon_type_slug = COALESCE(NULLIF(coupon_type_slug, ''), 'welcome_special'),
      usage_limit_per_customer = COALESCE(usage_limit_per_customer, 1),
      end_at = NULL,
      updated_at = now()
    WHERE id = v_coupon_id;
  END IF;

  SELECT setting_value INTO v_existing_setting
  FROM public.system_settings
  WHERE setting_key = 'wallet_welcome_bonus_auto_coupon_id';

  IF v_existing_setting IS NULL OR TRIM(v_existing_setting) = '' THEN
    UPDATE public.system_settings
    SET
      setting_value = v_coupon_id::text,
      updated_at = now()
    WHERE setting_key = 'wallet_welcome_bonus_auto_coupon_id';
  END IF;

  RAISE NOTICE 'Special Welcome coupon WELCOME_CI1000 id=% (is_public=false)', v_coupon_id;
END $$;
