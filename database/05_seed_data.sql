-- ============================================
-- MyFNG Seed Data
-- Initial data for roles and sample users
-- ============================================

-- Insert all 17 roles
INSERT INTO public.roles (role_code, role_name, description, permissions) VALUES
('SUPER_ADMIN', 'Super Admin', 'Full system owner with all permissions', '{"all": true}'::jsonb),
('SUB_ADMIN', 'Sub Admin', 'Department heads - Customer Service / Telecaller Manager / Auditor Manager', '{"manage_users": true, "view_reports": true}'::jsonb),
('LEAD_MANAGER', 'Lead Manager', 'Handles all normal service leads assignment to workshops', '{"manage_leads": true, "assign_leads": true}'::jsonb),
('RSA_MANAGER', 'RSA Manager', 'Handles roadside assistance leads and assigns company mechanics', '{"manage_rsa_leads": true, "assign_mechanics": true}'::jsonb),
('HOME_SERVICE_MANAGER', 'Home Service Manager', 'Handles Service at Home leads and assigns company service vans', '{"manage_home_service_leads": true, "assign_vans": true}'::jsonb),
('TELECALLER', 'Telecaller', 'Calls, follows up, updates CRM', '{"call_customers": true, "update_crm": true}'::jsonb),
('CUSTOMER_SERVICE_EXECUTIVE', 'Customer Service Executive', 'Manages customer updates, support, escalations', '{"handle_support": true, "manage_escalations": true}'::jsonb),
('AUDITOR', 'Auditor', 'Workshop verification & audit scoring', '{"audit_workshops": true, "update_scores": true}'::jsonb),
('ACCOUNTS_TEAM', 'Accounts Team', 'Invoices, payouts, refunds, settlements', '{"manage_payments": true, "generate_reports": true}'::jsonb),
('WORKSHOP_ADMIN', 'Workshop Admin', 'Internal admin at partner workshop - manages staff and accepts/rejects leads', '{"accept_reject_leads": true, "manage_staff": true}'::jsonb),
('WORKSHOP_SUPERVISOR', 'Workshop Supervisor', 'Assigns jobs inside workshop to mechanics/pickup boys', '{"assign_jobs": true, "manage_mechanics": true}'::jsonb),
('WORKSHOP_MECHANIC', 'Workshop Mechanic', 'Handles repair jobs inside workshop', '{"update_job_status": true, "upload_photos": true}'::jsonb),
('WORKSHOP_PICKUP_BOY', 'Workshop Pickup Boy', 'Handles pickup and delivery', '{"manage_pickups": true, "upload_photos": true}'::jsonb),
('COMPANY_MECHANIC_RSA', 'Company Mechanic (RSA)', 'Company-registered mechanic for RSA jobs', '{"handle_rsa_jobs": true, "update_status": true}'::jsonb),
('COMPANY_VAN_TECHNICIAN', 'Company Van Technician', 'Technician for Service at Home operations', '{"handle_home_service": true, "update_status": true}'::jsonb),
('COMPANY_VAN_DRIVER', 'Company Van Driver', 'Driver for service vans', '{"drive_vans": true, "assist_technician": true}'::jsonb),
('CUSTOMER', 'Customer', 'End user booking services', '{"book_services": true, "track_vehicle": true}'::jsonb)
ON CONFLICT (role_code) DO NOTHING;

-- Insert sample workshop
INSERT INTO public.workshops (name, address, city, state, pincode, contact_person, phone, email, is_verified, audit_score) VALUES
('ABC Motors', '123 Main Street, Andheri West', 'Mumbai', 'Maharashtra', '400058', 'Ramesh Kumar', '+91 9876543210', 'abc@motors.com', true, 4.5)
ON CONFLICT DO NOTHING;

-- Note: Sample users should be created through Supabase Auth
-- Then linked to users_login table with appropriate role_id

-- Comments
COMMENT ON TABLE roles IS 'All 17 user roles are seeded here with their permissions';

