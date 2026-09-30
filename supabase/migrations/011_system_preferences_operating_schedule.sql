-- Migration: 011_system_preferences_operating_schedule.sql
-- Description: Establishes system_preferences table with singleton constraint, operating schedule ranges, and Owner-exclusive RLS

-- 1. Create public.system_preferences table
CREATE TABLE IF NOT EXISTS public.system_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key VARCHAR(50) NOT NULL DEFAULT 'GLOBAL_PREFERENCES' UNIQUE,
    business_name VARCHAR(255) NOT NULL DEFAULT 'GlassFit',
    contact_email VARCHAR(255) NOT NULL DEFAULT 'glassfit@gmail.com',
    contact_phone VARCHAR(50) NOT NULL DEFAULT '+63 917 123 4567',
    operating_days_range VARCHAR(100) NOT NULL DEFAULT 'Monday - Saturday',
    operating_hours_range VARCHAR(100) NOT NULL DEFAULT '8:00 AM - 5:00 PM',
    operating_schedules JSONB NOT NULL DEFAULT '[
        {
            "id": "default-schedule-1",
            "start_day": "Monday",
            "end_day": "Saturday",
            "start_time": "08:00",
            "end_time": "17:00"
        }
    ]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(profile_id) ON DELETE SET NULL,
    CONSTRAINT system_preferences_singleton_check CHECK (singleton_key = 'GLOBAL_PREFERENCES')
);

-- 2. Trigger for updated_at
CREATE OR REPLACE TRIGGER set_system_preferences_updated_at
BEFORE UPDATE ON public.system_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Seed initial default enterprise preferences row
INSERT INTO public.system_preferences (
    singleton_key,
    business_name,
    contact_email,
    contact_phone,
    operating_days_range,
    operating_hours_range,
    operating_schedules
) VALUES (
    'GLOBAL_PREFERENCES',
    'GlassFit',
    'glassfit@gmail.com',
    '+63 917 123 4567',
    'Monday - Saturday',
    '8:00 AM - 5:00 PM',
    '[
        {
            "id": "default-schedule-1",
            "start_day": "Monday",
            "end_day": "Saturday",
            "start_time": "08:00",
            "end_time": "17:00"
        }
    ]'::jsonb
)
ON CONFLICT (singleton_key) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.system_preferences ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Read access: Publicly readable for active quotation generation, customer view, and back-office review
CREATE POLICY "system_preferences_read_policy" ON public.system_preferences
    FOR SELECT TO public
    USING (true);

-- Update access: Strictly restricted to authenticated Admins with Owner role
CREATE POLICY "system_preferences_owner_update_policy" ON public.system_preferences
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.admin_roles r ON r.role_id = p.admin_role_id
            WHERE p.profile_id = auth.uid()
            AND p.account_type = 'Admin'
            AND p.status = 'Active'
            AND r.role_name = 'Owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.admin_roles r ON r.role_id = p.admin_role_id
            WHERE p.profile_id = auth.uid()
            AND p.account_type = 'Admin'
            AND p.status = 'Active'
            AND r.role_name = 'Owner'
        )
    );

-- Mutations via Service Role client (bypasses RLS for trusted server actions)
CREATE POLICY "system_preferences_service_all" ON public.system_preferences
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
