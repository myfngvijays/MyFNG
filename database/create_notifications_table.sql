-- Create Notifications Table for Mobile & Web App
-- Task: Enable notification system across all platforms

-- Drop table if exists
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO' CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
    priority VARCHAR(50) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    lead_number VARCHAR(50),
    lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_lead_id ON public.notifications(lead_id);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = (SELECT id FROM public.users_login WHERE id = user_id));

-- RLS Policy: System can insert notifications
CREATE POLICY "System can insert notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- RLS Policy: Users can update their own notifications
CREATE POLICY "Users can update their own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = (SELECT id FROM public.users_login WHERE id = user_id));

-- RLS Policy: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
    ON public.notifications
    FOR DELETE
    USING (auth.uid() = (SELECT id FROM public.users_login WHERE id = user_id));

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Add comment
COMMENT ON TABLE public.notifications IS 'User notifications for mobile and web apps';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- Sample notification for testing
INSERT INTO public.notifications (user_id, title, message, type, priority, lead_number)
SELECT 
    id,
    'Welcome to MyFNG!',
    'Your account is now active. Start managing your tasks.',
    'INFO',
    'MEDIUM',
    NULL
FROM public.users_login
WHERE email = 'aman.g@roadserve.in'
LIMIT 1;

-- Success message
SELECT 'Notifications table created successfully!' as status;

