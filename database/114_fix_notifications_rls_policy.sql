-- Fix RLS Policy for notifications table
-- Problem: Current policy checks auth.uid() = users_login.id, but these don't always match
-- Solution: Use email-based matching (like NOTIFICATIONS_SCHEMA.sql)

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Create new SELECT policy using email matching
CREATE POLICY "Users can view their own notifications"
    ON public.notifications
    FOR SELECT
    USING (user_id = (SELECT id FROM public.users_login WHERE email = auth.email()));

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- Create new UPDATE policy using email matching
CREATE POLICY "Users can update their own notifications"
    ON public.notifications
    FOR UPDATE
    USING (user_id = (SELECT id FROM public.users_login WHERE email = auth.email()));

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

-- Create new DELETE policy using email matching
CREATE POLICY "Users can delete their own notifications"
    ON public.notifications
    FOR DELETE
    USING (user_id = (SELECT id FROM public.users_login WHERE email = auth.email()));

-- Success message
SELECT '✅ RLS policies updated to use email-based matching!' as status;

