-- ============================================
-- NOTIFICATIONS SYSTEM SCHEMA
-- ============================================
-- This schema adds notification system tables
-- Run this AFTER the main lead flow migration
-- ============================================

-- Create notification type ENUM
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM (
            'LEAD_ASSIGNED',
            'LEAD_ACCEPTED',
            'LEAD_REJECTED',
            'TEAM_ASSIGNED',
            'JOB_STARTED',
            'JOB_COMPLETED',
            'EXTRA_WORK_REQUESTED',
            'EXTRA_WORK_APPROVED',
            'EXTRA_WORK_REJECTED',
            'QC_APPROVED',
            'QC_REJECTED',
            'PICKUP_SCHEDULED',
            'PICKUP_STARTED',
            'PICKUP_COMPLETED',
            'OTP_VERIFIED',
            'INVOICE_GENERATED',
            'INVOICE_SENT',
            'PAYMENT_RECEIVED',
            'FOLLOW_UP_SCHEDULED',
            'LEAD_CLOSED',
            'SLA_WARNING',
            'SLA_BREACH'
        );
        RAISE NOTICE '✅ notification_type ENUM created!';
    ELSE
        RAISE NOTICE 'ℹ️  notification_type ENUM already exists, skipping...';
    END IF;
END $$;

-- Create notification priority ENUM
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
        CREATE TYPE notification_priority AS ENUM (
            'LOW',
            'MEDIUM',
            'HIGH',
            'URGENT'
        );
        RAISE NOTICE '✅ notification_priority ENUM created!';
    ELSE
        RAISE NOTICE 'ℹ️  notification_priority ENUM already exists, skipping...';
    END IF;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority notification_priority DEFAULT 'MEDIUM',
    
    -- Related entities
    lead_id UUID,
    lead_number VARCHAR(50),
    related_user_id UUID,
    related_user_name VARCHAR(255),
    
    -- Action and metadata
    action_url TEXT,
    metadata JSONB,
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users_login(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_lead FOREIGN KEY (lead_id) REFERENCES service_leads(id) ON DELETE CASCADE
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lead_id ON notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Global preferences
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    
    -- Specific notification type preferences (stored as JSONB)
    notification_types JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_prefs_user FOREIGN KEY (user_id) REFERENCES users_login(id) ON DELETE CASCADE
);

-- Create index for notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);

-- Create function to auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create notification preferences
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_notification_prefs') THEN
        CREATE TRIGGER trigger_create_notification_prefs
        AFTER INSERT ON users_login
        FOR EACH ROW
        EXECUTE FUNCTION create_default_notification_preferences();
        RAISE NOTICE '✅ Trigger created for auto-creating notification preferences!';
    ELSE
        RAISE NOTICE 'ℹ️  Trigger already exists, skipping...';
    END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (user_id = (SELECT id FROM users_login WHERE email = auth.email()));

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (user_id = (SELECT id FROM users_login WHERE email = auth.email()));

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (user_id = (SELECT id FROM users_login WHERE email = auth.email()));

-- Create RLS policies for notification preferences
CREATE POLICY "Users can view their own notification preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = (SELECT id FROM users_login WHERE email = auth.email()));

CREATE POLICY "Users can update their own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = (SELECT id FROM users_login WHERE email = auth.email()));

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check notifications table
SELECT 
    'notifications' as table_name,
    COUNT(*) as row_count
FROM notifications;

-- Check notification preferences
SELECT 
    'notification_preferences' as table_name,
    COUNT(*) as row_count
FROM notification_preferences;

-- Check ENUMs
SELECT 
    'notification_type ENUM' as enum_name,
    COUNT(*) as value_count
FROM pg_enum
WHERE enumtypid = 'notification_type'::regtype;

SELECT 
    'notification_priority ENUM' as enum_name,
    COUNT(*) as value_count
FROM pg_enum
WHERE enumtypid = 'notification_priority'::regtype;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '
    ============================================
    ✅ NOTIFICATIONS SCHEMA MIGRATION COMPLETE!
    ============================================
    
    Created/Verified:
    - ✅ notification_type ENUM (22 types)
    - ✅ notification_priority ENUM (4 levels)
    - ✅ notifications table
    - ✅ notification_preferences table
    - ✅ Indexes for performance
    - ✅ RLS policies for security
    - ✅ Auto-create preferences trigger
    
    Next Steps:
    1. Test notification creation
    2. Integrate with existing APIs
    3. Set up real-time subscriptions
    
    ============================================
    ';
END $$;
