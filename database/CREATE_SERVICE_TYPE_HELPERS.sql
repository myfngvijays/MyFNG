-- Create a view to get service type names easily
CREATE OR REPLACE VIEW service_types_view AS
SELECT 
  id,
  name as service_name,
  category as service_category,
  base_price,
  estimated_duration_minutes,
  description,
  is_active
FROM service_types
WHERE is_active = true;

-- Create a view for subservices
CREATE OR REPLACE VIEW subservices_view AS
SELECT 
  id,
  name as subservice_name,
  service_type_id,
  base_price,
  estimated_duration_minutes,
  description,
  is_active
FROM subservices
WHERE is_active = true;

-- Grant permissions
GRANT SELECT ON service_types_view TO authenticated, anon;
GRANT SELECT ON subservices_view TO authenticated, anon;

-- Function to get service type names from IDs (array input)
CREATE OR REPLACE FUNCTION get_service_type_names(service_ids text)
RETURNS text AS $$
DECLARE
  result text := '';
  service_array text[];
  service_id text;
  service_name text;
BEGIN
  -- Parse JSON array to get IDs
  service_array := ARRAY(SELECT jsonb_array_elements_text(service_ids::jsonb));
  
  FOR service_id IN SELECT unnest(service_array) LOOP
    SELECT st.name INTO service_name
    FROM service_types st
    WHERE st.id::text = service_id;
    
    IF service_name IS NOT NULL THEN
      IF result != '' THEN
        result := result || ', ';
      END IF;
      result := result || service_name;
    END IF;
  END LOOP;
  
  RETURN COALESCE(result, 'N/A');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get subservice names from IDs (array input)
CREATE OR REPLACE FUNCTION get_subservice_names(subservice_ids text)
RETURNS text AS $$
DECLARE
  result text := '';
  subservice_array text[];
  subservice_id text;
  subservice_name text;
BEGIN
  -- Parse JSON array to get IDs
  subservice_array := ARRAY(SELECT jsonb_array_elements_text(subservice_ids::jsonb));
  
  FOR subservice_id IN SELECT unnest(subservice_array) LOOP
    SELECT ss.name INTO subservice_name
    FROM subservices ss
    WHERE ss.id::text = subservice_id;
    
    IF subservice_name IS NOT NULL THEN
      IF result != '' THEN
        result := result || ', ';
      END IF;
      result := result || subservice_name;
    END IF;
  END LOOP;
  
  RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Service type helper functions created!';
END $$;

