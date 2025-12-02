-- =====================================================
-- CREATE PRICING LOOKUP FUNCTIONS
-- Purpose: PostgreSQL functions to get prices based on priority
-- =====================================================

-- Function to get Service Type price
CREATE OR REPLACE FUNCTION get_service_price(
  p_workshop_id UUID,
  p_service_type_id UUID,
  p_vehicle_class VARCHAR DEFAULT NULL,
  p_zone_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_price NUMERIC;
BEGIN
  -- Priority 1: Workshop + Service Type + Class + Zone
  SELECT custom_price INTO v_price
  FROM public.workshop_service_pricing
  WHERE workshop_id = p_workshop_id
    AND service_type_id = p_service_type_id
    AND (class = p_vehicle_class OR (class IS NULL AND p_vehicle_class IS NULL))
    AND (zone_id = p_zone_id OR (zone_id IS NULL AND p_zone_id IS NULL))
  ORDER BY 
    CASE WHEN class IS NOT NULL AND zone_id IS NOT NULL THEN 1
         WHEN class IS NOT NULL AND zone_id IS NULL THEN 2
         WHEN class IS NULL AND zone_id IS NOT NULL THEN 3
         ELSE 4 END
  LIMIT 1;

  -- If found, return it
  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- Priority 2: Try with class only (zone = NULL)
  IF p_vehicle_class IS NOT NULL THEN
    SELECT custom_price INTO v_price
    FROM public.workshop_service_pricing
    WHERE workshop_id = p_workshop_id
      AND service_type_id = p_service_type_id
      AND class = p_vehicle_class
      AND zone_id IS NULL
    LIMIT 1;

    IF v_price IS NOT NULL THEN
      RETURN v_price;
    END IF;
  END IF;

  -- Priority 3: Try with zone only (class = NULL)
  IF p_zone_id IS NOT NULL THEN
    SELECT custom_price INTO v_price
    FROM public.workshop_service_pricing
    WHERE workshop_id = p_workshop_id
      AND service_type_id = p_service_type_id
      AND class IS NULL
      AND zone_id = p_zone_id
    LIMIT 1;

    IF v_price IS NOT NULL THEN
      RETURN v_price;
    END IF;
  END IF;

  -- Priority 4: Workshop default (both NULL)
  SELECT custom_price INTO v_price
  FROM public.workshop_service_pricing
  WHERE workshop_id = p_workshop_id
    AND service_type_id = p_service_type_id
    AND class IS NULL
    AND zone_id IS NULL
  LIMIT 1;

  -- If still not found, return 0 (or could return service_types default_price if column exists)
  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get Product price
CREATE OR REPLACE FUNCTION get_product_price(
  p_workshop_id UUID,
  p_product_id UUID,
  p_vehicle_class VARCHAR DEFAULT NULL,
  p_zone_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_price NUMERIC;
BEGIN
  -- Priority 1: Workshop + Product + Class + Zone
  SELECT selling_price INTO v_price
  FROM public.workshop_product_pricing
  WHERE workshop_id = p_workshop_id
    AND product_id = p_product_id
    AND (class = p_vehicle_class OR (class IS NULL AND p_vehicle_class IS NULL))
    AND (zone_id = p_zone_id OR (zone_id IS NULL AND p_zone_id IS NULL))
  ORDER BY 
    CASE WHEN class IS NOT NULL AND zone_id IS NOT NULL THEN 1
         WHEN class IS NOT NULL AND zone_id IS NULL THEN 2
         WHEN class IS NULL AND zone_id IS NOT NULL THEN 3
         ELSE 4 END
  LIMIT 1;

  -- If found, return it
  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- Priority 2: Try with class only (zone = NULL)
  IF p_vehicle_class IS NOT NULL THEN
    SELECT selling_price INTO v_price
    FROM public.workshop_product_pricing
    WHERE workshop_id = p_workshop_id
      AND product_id = p_product_id
      AND class = p_vehicle_class
      AND zone_id IS NULL
    LIMIT 1;

    IF v_price IS NOT NULL THEN
      RETURN v_price;
    END IF;
  END IF;

  -- Priority 3: Try with zone only (class = NULL)
  IF p_zone_id IS NOT NULL THEN
    SELECT selling_price INTO v_price
    FROM public.workshop_product_pricing
    WHERE workshop_id = p_workshop_id
      AND product_id = p_product_id
      AND class IS NULL
      AND zone_id = p_zone_id
    LIMIT 1;

    IF v_price IS NOT NULL THEN
      RETURN v_price;
    END IF;
  END IF;

  -- Priority 4: Workshop default (both NULL)
  SELECT selling_price INTO v_price
  FROM public.workshop_product_pricing
  WHERE workshop_id = p_workshop_id
    AND product_id = p_product_id
    AND class IS NULL
    AND zone_id IS NULL
  LIMIT 1;

  -- Priority 5: Master product default price
  IF v_price IS NULL THEN
    SELECT default_price INTO v_price
    FROM public.master_products
    WHERE id = p_product_id;
  END IF;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comments
COMMENT ON FUNCTION get_service_price IS 'Returns service type price based on workshop, class, and zone priority';
COMMENT ON FUNCTION get_product_price IS 'Returns product price based on workshop, class, and zone priority';

DO $$
BEGIN
    RAISE NOTICE '✅ Pricing lookup functions created successfully!';
END $$;

