-- Migration 014: System Preferences Backup Tracking & Aggregated Business Analytics
-- Establishes backup audit columns and an atomic analytics aggregation procedure

-- 1. Add backup tracking columns to public.system_preferences
ALTER TABLE public.system_preferences
ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_backup_by UUID REFERENCES public.profiles(profile_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.system_preferences.last_backup_at IS 'Timestamp of the most recent successful system backup generation';
COMMENT ON COLUMN public.system_preferences.last_backup_by IS 'Profile ID of the Owner administrator who initiated the backup';

-- 2. Stored function to atomically record system backup execution
CREATE OR REPLACE FUNCTION public.record_system_backup(
    p_admin_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_at TIMESTAMPTZ;
    v_is_owner BOOLEAN;
BEGIN
    -- Verify that the caller is an active Owner administrator
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.admin_roles r ON r.role_id = p.admin_role_id
        WHERE p.profile_id = p_admin_id
          AND p.account_type = 'Admin'
          AND p.status = 'Active'
          AND lower(r.role_name) = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Unauthorized: Only an active Owner administrator may record system backups'
            USING ERRCODE = '42501';
    END IF;

    -- Update the singleton system preferences record
    UPDATE public.system_preferences
    SET last_backup_at = now(),
        last_backup_by = p_admin_id,
        updated_at = now()
    WHERE singleton_key = 'GLOBAL_PREFERENCES'
    RETURNING last_backup_at INTO v_updated_at;

    RETURN v_updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.record_system_backup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_system_backup(UUID) TO authenticated;

-- 3. Stored function for high-performance business analytics aggregation
CREATE OR REPLACE FUNCTION public.get_admin_business_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
    v_start TIMESTAMPTZ := COALESCE(p_start_date, '1970-01-01 00:00:00+00'::timestamptz);
    v_end TIMESTAMPTZ := COALESCE(p_end_date, now());
BEGIN
    -- Verify caller is an authenticated administrator
    IF NOT (public.is_admin() OR public.has_admin_permission('manage_settings') OR public.has_admin_permission('manage_bookings')) THEN
        RAISE EXCEPTION 'Unauthorized: Administrative access required for analytics'
            USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'overview', (
            SELECT jsonb_build_object(
                'total_bookings', count(*),
                'pending_count', count(*) FILTER (WHERE br.status = 'Pending'),
                'ongoing_count', count(*) FILTER (WHERE br.status = 'Ongoing'),
                'done_count', count(*) FILTER (WHERE br.status = 'Done'),
                'total_estimated_value', COALESCE(sum(qe.total_estimated_amount), 0),
                'total_negotiated_value', COALESCE(sum(COALESCE(qe.negotiated_amount, qe.total_estimated_amount)), 0),
                'avg_quotation_value', COALESCE(round(avg(COALESCE(qe.negotiated_amount, qe.total_estimated_amount)), 2), 0)
            )
            FROM public.booking_requests br
            LEFT JOIN public.signed_booking_links sbl ON sbl.link_id = br.link_id
            LEFT JOIN public.quotation_estimates qe ON qe.quotation_id = sbl.quotation_id
            WHERE br.created_at >= v_start AND br.created_at <= v_end
        ),
        'platforms', (
            SELECT jsonb_build_object(
                'messenger_count', count(*) FILTER (WHERE br.selected_platform = 'Messenger'),
                'viber_count', count(*) FILTER (WHERE br.selected_platform = 'Viber'),
                'other_count', count(*) FILTER (WHERE br.selected_platform NOT IN ('Messenger', 'Viber') OR br.selected_platform IS NULL)
            )
            FROM public.booking_requests br
            WHERE br.created_at >= v_start AND br.created_at <= v_end
        ),
        'catalog', (
            SELECT jsonb_build_object(
                'total_products', count(*),
                'active_products', count(*) FILTER (WHERE p.status = 'Active'),
                'draft_products', count(*) FILTER (WHERE p.status != 'Active'),
                'avg_base_price', COALESCE(round(avg(p.base_price), 2), 0)
            )
            FROM public.products p
        ),
        'product_distribution', (
            SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
            FROM (
                SELECT p.product_type AS type_name, count(*) AS count
                FROM public.products p
                GROUP BY p.product_type
                ORDER BY count DESC
            ) sub
        ),
        'monthly_trends', (
            SELECT COALESCE(jsonb_agg(trend_row), '[]'::jsonb)
            FROM (
                SELECT
                    to_char(date_trunc('month', br.created_at), 'YYYY-MM') AS month_label,
                    count(*) AS count,
                    COALESCE(sum(COALESCE(qe.negotiated_amount, qe.total_estimated_amount)), 0) AS total_value
                FROM public.booking_requests br
                LEFT JOIN public.signed_booking_links sbl ON sbl.link_id = br.link_id
                LEFT JOIN public.quotation_estimates qe ON qe.quotation_id = sbl.quotation_id
                WHERE br.created_at >= (now() - interval '6 months')
                GROUP BY date_trunc('month', br.created_at)
                ORDER BY date_trunc('month', br.created_at) ASC
            ) trend_row
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_business_analytics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_business_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
