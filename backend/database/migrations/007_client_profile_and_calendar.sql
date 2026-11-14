-- ============================================================
-- Migration 007: Client Business Profile and Monthly Calendar
-- ============================================================

-- 1. Extend existing client records.
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS business_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS joining_date DATE,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS monthly_reels_commitment INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_posts_commitment INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS contact_number VARCHAR(30);

-- Prevent negative monthly commitments.
ALTER TABLE public.clients
    DROP CONSTRAINT IF EXISTS clients_monthly_reels_commitment_check;

ALTER TABLE public.clients
    ADD CONSTRAINT clients_monthly_reels_commitment_check
    CHECK (monthly_reels_commitment >= 0);

ALTER TABLE public.clients
    DROP CONSTRAINT IF EXISTS clients_monthly_posts_commitment_check;

ALTER TABLE public.clients
    ADD CONSTRAINT clients_monthly_posts_commitment_check
    CHECK (monthly_posts_commitment >= 0);


-- 2. Create the client calendar events table.
CREATE TABLE IF NOT EXISTS public.client_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL
        REFERENCES public.clients(id) ON DELETE CASCADE,

    event_date DATE NOT NULL,

    title VARCHAR(200) NOT NULL,

    event_type VARCHAR(30) NOT NULL DEFAULT 'other',

    description TEXT,

    start_time TIME,
    end_time TIME,

    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT client_calendar_events_type_check
    CHECK (
        event_type IN (
            'shoot',
            'editing',
            'video_uploaded',
            'campaign_launch',
            'holiday',
            'other'
        )
    ),

    CONSTRAINT client_calendar_events_time_check
    CHECK (
        start_time IS NULL
        OR end_time IS NULL
        OR end_time > start_time
    )
);


-- 3. Indexes for monthly calendar queries.
CREATE INDEX IF NOT EXISTS idx_client_calendar_events_client_date
ON public.client_calendar_events (client_id, event_date);

CREATE INDEX IF NOT EXISTS idx_client_calendar_events_date
ON public.client_calendar_events (event_date);


-- 4. Enable Row Level Security.
ALTER TABLE public.client_calendar_events
ENABLE ROW LEVEL SECURITY;


-- 5. Admins can manage all client calendar events.
DROP POLICY IF EXISTS "Admins can manage client calendar events"
ON public.client_calendar_events;

CREATE POLICY "Admins can manage client calendar events"
ON public.client_calendar_events
FOR ALL
TO authenticated
USING (
    public.current_user_role() = 'admin'
)
WITH CHECK (
    public.current_user_role() = 'admin'
);


-- 6. Clients can only view their own calendar events.
DROP POLICY IF EXISTS "Clients can view their own calendar events"
ON public.client_calendar_events;

CREATE POLICY "Clients can view their own calendar events"
ON public.client_calendar_events
FOR SELECT
TO authenticated
USING (
    client_id = public.current_user_client_id()
);


-- ============================================================
-- END OF MIGRATION 007
-- ============================================================