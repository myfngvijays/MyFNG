-- Create mechanic_extra_work_requests table
CREATE TABLE IF NOT EXISTS mechanic_extra_work_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  request_type varchar(50) NOT NULL DEFAULT 'ADDITIONAL_WORK',
  description text NOT NULL,
  estimated_cost decimal(10,2),
  estimated_time_hours decimal(5,2),
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  approved_by uuid REFERENCES users_login(id),
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_extra_work_lead ON mechanic_extra_work_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_mechanic ON mechanic_extra_work_requests(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_status ON mechanic_extra_work_requests(status);

-- Create mechanic_performance_metrics table
CREATE TABLE IF NOT EXISTS mechanic_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  jobs_assigned integer DEFAULT 0,
  jobs_completed integer DEFAULT 0,
  jobs_in_progress integer DEFAULT 0,
  jobs_on_hold integer DEFAULT 0,
  avg_completion_time_hours decimal(10,2),
  total_work_hours decimal(10,2) DEFAULT 0,
  customer_rating decimal(3,2),
  sla_compliance_rate decimal(5,2),
  extra_work_requests integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(mechanic_id, date)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_performance_mechanic ON mechanic_performance_metrics(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_performance_date ON mechanic_performance_metrics(date);

-- Create mechanic_media table for images/videos
CREATE TABLE IF NOT EXISTS mechanic_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  media_type varchar(20) NOT NULL DEFAULT 'IMAGE', -- IMAGE, VIDEO
  media_category varchar(20) NOT NULL DEFAULT 'BEFORE', -- BEFORE, PROGRESS, AFTER
  file_url text NOT NULL,
  file_name varchar(255),
  file_size_kb integer,
  caption text,
  uploaded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_media_lead ON mechanic_media(lead_id);
CREATE INDEX IF NOT EXISTS idx_media_mechanic ON mechanic_media(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_media_category ON mechanic_media(media_category);

-- Create service_checklists table
CREATE TABLE IF NOT EXISTS service_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  mechanic_id uuid REFERENCES users_login(id),
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_items integer DEFAULT 0,
  total_items integer DEFAULT 0,
  completion_percentage decimal(5,2) DEFAULT 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(lead_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_checklist_lead ON service_checklists(lead_id);
CREATE INDEX IF NOT EXISTS idx_checklist_mechanic ON service_checklists(mechanic_id);

-- Create mechanic_parts_usage table
CREATE TABLE IF NOT EXISTS mechanic_parts_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES users_login(id) ON DELETE CASCADE,
  part_name varchar(255) NOT NULL,
  part_code varchar(100),
  quantity decimal(10,2) NOT NULL DEFAULT 1,
  unit varchar(20) DEFAULT 'piece',
  unit_price decimal(10,2),
  total_price decimal(10,2),
  supplier varchar(255),
  notes text,
  added_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_parts_lead ON mechanic_parts_usage(lead_id);
CREATE INDEX IF NOT EXISTS idx_parts_mechanic ON mechanic_parts_usage(mechanic_id);

-- Grant permissions
GRANT ALL ON mechanic_extra_work_requests TO authenticated;
GRANT ALL ON mechanic_performance_metrics TO authenticated;
GRANT ALL ON mechanic_media TO authenticated;
GRANT ALL ON service_checklists TO authenticated;
GRANT ALL ON mechanic_parts_usage TO authenticated;

-- Enable RLS
ALTER TABLE mechanic_extra_work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_parts_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mechanic_extra_work_requests
CREATE POLICY "Mechanics can view their own requests" ON mechanic_extra_work_requests
  FOR SELECT USING (mechanic_id = auth.uid());

CREATE POLICY "Mechanics can create requests" ON mechanic_extra_work_requests
  FOR INSERT WITH CHECK (mechanic_id = auth.uid());

CREATE POLICY "Admins can view all requests" ON mechanic_extra_work_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_login ul
      INNER JOIN roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() 
      AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  );

CREATE POLICY "Admins can update requests" ON mechanic_extra_work_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users_login ul
      INNER JOIN roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() 
      AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  );

-- RLS Policies for mechanic_performance_metrics
CREATE POLICY "Mechanics can view their own metrics" ON mechanic_performance_metrics
  FOR SELECT USING (mechanic_id = auth.uid());

CREATE POLICY "Admins can view all metrics" ON mechanic_performance_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_login ul
      INNER JOIN roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() 
      AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  );

-- RLS Policies for mechanic_media
CREATE POLICY "Mechanics can manage their own media" ON mechanic_media
  FOR ALL USING (mechanic_id = auth.uid());

CREATE POLICY "Admins can view all media" ON mechanic_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_login ul
      INNER JOIN roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() 
      AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  );

-- RLS Policies for service_checklists
CREATE POLICY "Mechanics can manage checklists for their jobs" ON service_checklists
  FOR ALL USING (
    mechanic_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM mechanic_jobs mj 
      WHERE mj.lead_id = service_checklists.lead_id 
      AND mj.mechanic_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all checklists" ON service_checklists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_login ul
      INNER JOIN roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() 
      AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  );

-- RLS Policies for mechanic_parts_usage
CREATE POLICY "Mechanics can manage their own parts" ON mechanic_parts_usage
  FOR ALL USING (mechanic_id = auth.uid());

CREATE POLICY "Admins can view all parts" ON mechanic_parts_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users_login ul
      INNER JOIN roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid() 
      AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All mechanic support tables created successfully!';
END $$;

