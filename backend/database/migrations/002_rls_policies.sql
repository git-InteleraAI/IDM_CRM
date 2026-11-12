-- =========================================================
-- INTELERA DM PORTAL
-- Migration: 002_rls_policies
-- Purpose: Database access control and tenant isolation
-- =========================================================

-- 1. SECURITY HELPER FUNCTIONS
-- SECURITY DEFINER allows these functions to read profiles
-- without recursively triggering profile RLS policies.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.client_id
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
    LIMIT 1;
$$;

-- Only authenticated application users may execute these helpers.

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_client_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO authenticated;


-- 2. ENABLE ROW LEVEL SECURITY

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- 3. CLIENTS

CREATE POLICY clients_admin_all
ON public.clients
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY clients_client_select
ON public.clients
FOR SELECT
TO authenticated
USING (
    id = (SELECT public.current_user_client_id())
);


-- 4. PROFILES

CREATE POLICY profiles_admin_all
ON public.profiles
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY profiles_user_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = (SELECT auth.uid())
);


-- 5. CAMPAIGNS

CREATE POLICY campaigns_admin_all
ON public.campaigns
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY campaigns_client_select
ON public.campaigns
FOR SELECT
TO authenticated
USING (
    client_id = (SELECT public.current_user_client_id())
);


-- 6. LEADS

CREATE POLICY leads_admin_all
ON public.leads
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY leads_client_select
ON public.leads
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.campaigns AS c
        WHERE c.id = leads.campaign_id
          AND c.client_id = (
              SELECT public.current_user_client_id()
          )
    )
);


-- 7. LEAD ACTIVITIES

CREATE POLICY lead_activities_admin_all
ON public.lead_activities
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY lead_activities_client_select
ON public.lead_activities
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.leads AS l
        JOIN public.campaigns AS c
          ON c.id = l.campaign_id
        WHERE l.id = lead_activities.lead_id
          AND c.client_id = (
              SELECT public.current_user_client_id()
          )
    )
);


-- 8. REMINDERS

CREATE POLICY reminders_admin_all
ON public.reminders
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY reminders_client_select
ON public.reminders
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.leads AS l
        JOIN public.campaigns AS c
          ON c.id = l.campaign_id
        WHERE l.id = reminders.lead_id
          AND c.client_id = (
              SELECT public.current_user_client_id()
          )
    )
);


-- 9. SYNC LOGS
-- Synchronization logs are restricted to administrators.

CREATE POLICY sync_logs_admin_all
ON public.sync_logs
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);


-- 10. NOTIFICATIONS

CREATE POLICY notifications_admin_all
ON public.notifications
FOR ALL
TO authenticated
USING (
    (SELECT public.current_user_role()) = 'admin'
)
WITH CHECK (
    (SELECT public.current_user_role()) = 'admin'
);

CREATE POLICY notifications_user_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);

-- =========================================================
-- 11. TABLE PRIVILEGES
-- RLS policies continue to control which operations
-- authenticated users can actually perform.
-- =========================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO authenticated;

-- =========================================================
-- END OF MIGRATION
-- =========================================================

