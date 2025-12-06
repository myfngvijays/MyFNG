-- Create web_car_brand table for managing brand logos
CREATE TABLE IF NOT EXISTS public.web_car_brand (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Add foreign key constraints only if users_login table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users_login') THEN
    ALTER TABLE public.web_car_brand 
      ADD CONSTRAINT web_car_brand_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_login(id);
    
    ALTER TABLE public.web_car_brand 
      ADD CONSTRAINT web_car_brand_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_login(id);
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_web_car_brand_is_active ON public.web_car_brand(is_active);
CREATE INDEX IF NOT EXISTS idx_web_car_brand_display_order ON public.web_car_brand(display_order);

-- Enable RLS
ALTER TABLE public.web_car_brand ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow all authenticated users to read active brands
CREATE POLICY "Anyone can view active car brands"
  ON public.web_car_brand
  FOR SELECT
  USING (is_active = true);

-- Allow super admin to manage brands (only if users_login and roles tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users_login')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
    CREATE POLICY "Super admin can manage car brands"
      ON public.web_car_brand
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 
          FROM public.users_login ul
          JOIN public.roles r ON r.id = ul.role_id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      );
  ELSE
    -- If tables don't exist, allow all authenticated users (temporary)
    CREATE POLICY "Authenticated users can manage car brands"
      ON public.web_car_brand
      FOR ALL
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_car_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_web_car_brand_updated_at
  BEFORE UPDATE ON public.web_car_brand
  FOR EACH ROW
  EXECUTE FUNCTION update_car_brands_updated_at();

-- Insert default brands (21 major car brands)
-- Note: logo_url is set to empty string initially, admin can upload logos later
INSERT INTO public.web_car_brand (name, logo_url, display_order, is_active) VALUES
('Maruti Suzuki', 'https://via.placeholder.com/200x100?text=Maruti+Suzuki', 1, true),
('Hyundai', 'https://via.placeholder.com/200x100?text=Hyundai', 2, true),
('Tata', 'https://via.placeholder.com/200x100?text=Tata', 3, true),
('Honda', 'https://via.placeholder.com/200x100?text=Honda', 4, true),
('Toyota', 'https://via.placeholder.com/200x100?text=Toyota', 5, true),
('Mahindra', 'https://via.placeholder.com/200x100?text=Mahindra', 6, true),
('Kia', 'https://via.placeholder.com/200x100?text=Kia', 7, true),
('MG', 'https://via.placeholder.com/200x100?text=MG', 8, true),
('Nissan', 'https://via.placeholder.com/200x100?text=Nissan', 9, true),
('Renault', 'https://via.placeholder.com/200x100?text=Renault', 10, true),
('Ford', 'https://via.placeholder.com/200x100?text=Ford', 11, true),
('Skoda', 'https://via.placeholder.com/200x100?text=Skoda', 12, true),
('Volkswagen', 'https://via.placeholder.com/200x100?text=Volkswagen', 13, true),
('Chevrolet', 'https://via.placeholder.com/200x100?text=Chevrolet', 14, true),
('FCA', 'https://via.placeholder.com/200x100?text=FCA', 15, true),
('Mercedes-Benz', 'https://via.placeholder.com/200x100?text=Mercedes-Benz', 16, true),
('Jaguar', 'https://via.placeholder.com/200x100?text=Jaguar', 17, true),
('BMW', 'https://via.placeholder.com/200x100?text=BMW', 18, true),
('Audi', 'https://via.placeholder.com/200x100?text=Audi', 19, true),
('Isuzu', 'https://via.placeholder.com/200x100?text=Isuzu', 20, true),
('Jeep', 'https://via.placeholder.com/200x100?text=Jeep', 21, true)
ON CONFLICT (name) DO NOTHING;
