-- Migration: 010_staff_invitations_and_roles.sql
-- Description: Establishes staff_invitations persistence table, status constraints, and RLS policies

-- 1. Create public.staff_invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    verification_code VARCHAR(6) NOT NULL,
    role_id UUID NOT NULL REFERENCES public.admin_roles(role_id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT staff_invitations_status_check CHECK (status IN ('Pending', 'Accepted', 'Expired', 'Revoked')),
    CONSTRAINT staff_invitations_code_check CHECK (verification_code ~ '^[0-9]{6}$')
);

-- 2. Indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON public.staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON public.staff_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON public.staff_invitations(status);

-- 3. Trigger for updated_at
CREATE OR REPLACE TRIGGER set_staff_invitations_updated_at
BEFORE UPDATE ON public.staff_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Only authenticated Admins with manage_roles permission can read invitations
CREATE POLICY "staff_invitations_admin_read" ON public.staff_invitations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.admin_roles r ON r.role_id = p.admin_role_id
            WHERE p.profile_id = auth.uid()
            AND p.account_type = 'Admin'
            AND p.status = 'Active'
            AND (r.role_name = 'Owner' OR (r.permissions->>'manage_roles')::boolean = true)
        )
    );

-- Mutations restricted to service role client (via Server Actions)
CREATE POLICY "staff_invitations_service_all" ON public.staff_invitations
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
