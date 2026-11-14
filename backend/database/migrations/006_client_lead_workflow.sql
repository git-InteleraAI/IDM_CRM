-- =========================================================
-- INTELERA DM PORTAL
-- Migration: 006_client_lead_workflow
-- Purpose: Client lead workflow management
-- =========================================================

-- 1. Add a separate workflow status.
-- Existing records automatically become pending.
-- This is intentionally separate from the Meta lead response.

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30)
NOT NULL DEFAULT 'pending';

-- 2. Restrict workflow status to supported values.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'leads_workflow_status_check'
          AND conrelid = 'public.leads'::regclass
    ) THEN
        ALTER TABLE public.leads
        ADD CONSTRAINT leads_workflow_status_check
        CHECK (
            workflow_status IN (
                'pending',
                'followed_up',
                'completed'
            )
        );
    END IF;
END
$$;

-- 3. Index for dashboard counts and status filtering.

CREATE INDEX IF NOT EXISTS idx_leads_workflow_status
ON public.leads(workflow_status);

-- 4. Composite index for campaign-specific workflow views.

CREATE INDEX IF NOT EXISTS idx_leads_campaign_workflow
ON public.leads(campaign_id, workflow_status);

-- 5. Support chronological lead activity history.

CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at
ON public.lead_activities(lead_id, created_at DESC);

-- =========================================================
-- END OF MIGRATION 006
-- =========================================================