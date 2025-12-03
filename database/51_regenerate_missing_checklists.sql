-- =====================================================
-- REGENERATE MISSING CHECKLISTS FOR EXISTING JOBS
-- Purpose: Create checklists for mechanic jobs that don't have one
-- Date: 2025-12-02
-- =====================================================

-- Drop existing function if it exists (to avoid return type conflicts)
DROP FUNCTION IF EXISTS regenerate_missing_checklists();

-- Function to regenerate missing checklists
CREATE OR REPLACE FUNCTION regenerate_missing_checklists()
RETURNS TABLE (
  job_id uuid,
  lead_id uuid,
  mechanic_id uuid,
  service_type varchar,
  checklist_created boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_record RECORD;
  v_service_type_name varchar;
  v_checklist_id uuid;
  v_service_ids text[];
  v_first_service_id uuid;
  v_service_name varchar;
BEGIN
  -- Find all mechanic jobs without checklists
  FOR v_job_record IN
    SELECT 
      mj.id as job_id,
      mj.lead_id,
      mj.mechanic_id,
      sl.service_type,
      sl.service_type_ids
    FROM public.mechanic_jobs mj
    JOIN public.service_leads sl ON mj.lead_id = sl.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.service_checklists sc
      WHERE sc.lead_id = mj.lead_id
      AND sc.mechanic_id = mj.mechanic_id
    )
  LOOP
    -- Get service type name
    v_service_type_name := NULL;
    v_service_ids := NULL;
    v_first_service_id := NULL;
    v_service_name := NULL;
    
    -- Try to get service type from service_type_ids (JSONB array)
    IF v_job_record.service_type_ids IS NOT NULL THEN
      BEGIN
        -- Parse service_type_ids - handle both JSONB and text formats
        IF pg_typeof(v_job_record.service_type_ids) = 'jsonb'::regtype THEN
          -- Already JSONB
          v_service_ids := ARRAY(
            SELECT jsonb_array_elements_text(v_job_record.service_type_ids)
          );
        ELSIF pg_typeof(v_job_record.service_type_ids) = 'text'::regtype THEN
          -- Try to parse as JSON string
          BEGIN
            v_service_ids := ARRAY(
              SELECT jsonb_array_elements_text(v_job_record.service_type_ids::jsonb)
            );
          EXCEPTION WHEN OTHERS THEN
            -- If parsing fails, try as single UUID
            BEGIN
              v_service_ids := ARRAY[v_job_record.service_type_ids::text];
            EXCEPTION WHEN OTHERS THEN
              v_service_ids := NULL;
            END;
          END;
        ELSE
          -- Try to cast to text and parse
          BEGIN
            v_service_ids := ARRAY(
              SELECT jsonb_array_elements_text(v_job_record.service_type_ids::text::jsonb)
            );
          EXCEPTION WHEN OTHERS THEN
            v_service_ids := NULL;
          END;
        END IF;
        
        -- Get first service type name from UUID
        IF v_service_ids IS NOT NULL AND array_length(v_service_ids, 1) > 0 THEN
          BEGIN
            v_first_service_id := v_service_ids[1]::uuid;
            
            -- Fetch service type name from service_types table
            SELECT name INTO v_service_name
            FROM public.service_types
            WHERE id = v_first_service_id
            AND is_active = true;
            
            IF v_service_name IS NOT NULL THEN
              v_service_type_name := v_service_name;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- If UUID parsing fails, skip
            NULL;
          END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- If any error occurs, continue with fallback
        NULL;
      END;
    END IF;
    
    -- Fallback: Try service_type column (might be UUID or name)
    IF v_service_type_name IS NULL AND v_job_record.service_type IS NOT NULL THEN
      BEGIN
        -- Try to treat as UUID first
        BEGIN
          SELECT name INTO v_service_name
          FROM public.service_types
          WHERE id = v_job_record.service_type::uuid
          AND is_active = true;
          
          IF v_service_name IS NOT NULL THEN
            v_service_type_name := v_service_name;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- If not UUID, treat as name directly
          v_service_type_name := v_job_record.service_type;
        END;
      EXCEPTION WHEN OTHERS THEN
        v_service_type_name := v_job_record.service_type;
      END;
    END IF;
    
    -- Default fallback
    IF v_service_type_name IS NULL OR v_service_type_name = '' THEN
      v_service_type_name := 'GENERAL_SERVICE';
    END IF;
    
    -- Generate checklist
    BEGIN
      SELECT generate_service_checklist(
        v_job_record.lead_id,
        v_job_record.mechanic_id,
        v_service_type_name
      ) INTO v_checklist_id;
      
      RETURN QUERY SELECT 
        v_job_record.job_id,
        v_job_record.lead_id,
        v_job_record.mechanic_id,
        v_service_type_name,
        true;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      RETURN QUERY SELECT 
        v_job_record.job_id,
        v_job_record.lead_id,
        v_job_record.mechanic_id,
        v_service_type_name,
        false;
    END;
  END LOOP;
END;
$$;

-- Run the function to regenerate missing checklists
DO $$
DECLARE
  v_result RECORD;
  v_count integer := 0;
BEGIN
  FOR v_result IN SELECT * FROM regenerate_missing_checklists() LOOP
    v_count := v_count + 1;
    IF v_result.checklist_created THEN
      RAISE NOTICE '✅ Created checklist for job_id: %, lead_id: %, mechanic_id: %, service_type: %', 
        v_result.job_id, v_result.lead_id, v_result.mechanic_id, v_result.service_type;
    ELSE
      RAISE WARNING '⚠️ Failed to create checklist for job_id: %, lead_id: %, mechanic_id: %', 
        v_result.job_id, v_result.lead_id, v_result.mechanic_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE '📊 Total checklists processed: %', v_count;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Missing Checklists Regeneration Complete!';
END $$;

