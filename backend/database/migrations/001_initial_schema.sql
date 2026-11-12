-- =========================================================
-- INTELERA DM PORTAL
-- Migration: 001_initial_schema
-- Database: Supabase PostgreSQL
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. CLIENTS
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    logo_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROFILES
-- auth.users is managed by Supabase Auth.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'client')),
    client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profile_client_role_check CHECK (
        (role = 'admin' AND client_id IS NULL)
        OR
        (role = 'client' AND client_id IS NOT NULL)
    )
);

-- 3. CAMPAIGNS
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL
        REFERENCES public.clients(id) ON DELETE RESTRICT,

    name VARCHAR(200) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'completed')),

    sheet_url TEXT NOT NULL,
    spreadsheet_id TEXT NOT NULL,
    worksheet_gid TEXT,

    sync_interval_minutes INTEGER NOT NULL DEFAULT 30
        CHECK (sync_interval_minutes BETWEEN 5 AND 1440),

    last_synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_spreadsheet_campaign
        UNIQUE (spreadsheet_id)
);

-- 4. LEADS
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    campaign_id UUID NOT NULL
        REFERENCES public.campaigns(id) ON DELETE RESTRICT,

    source_lead_id TEXT NOT NULL,

    -- Imported source information
    full_name TEXT,
    phone_number TEXT,
    email TEXT,
    area TEXT,
    created_time TIMESTAMPTZ,
    platform TEXT,

    -- Meta source metadata
    meta_campaign_id TEXT,
    meta_campaign_name TEXT,
    ad_id TEXT,
    ad_name TEXT,
    adset_id TEXT,
    adset_name TEXT,
    form_id TEXT,
    form_name TEXT,

    source_status TEXT,
    priority TEXT,

    -- Original imported source row
    raw_data JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- Client-managed information
    call_done_date DATE,

    response VARCHAR(30) CHECK (
        response IN (
            'not_contacted',
            'interested',
            'not_interested',
            'call_back_required',
            'no_response',
            'invalid_contact',
            'converted'
        )
    ),

    comments TEXT,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_campaign_source_lead
        UNIQUE (campaign_id, source_lead_id)
);

-- 5. LEAD ACTIVITIES
CREATE TABLE public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id UUID NOT NULL
        REFERENCES public.leads(id) ON DELETE RESTRICT,

    activity_type VARCHAR(50) NOT NULL,
    description TEXT,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. REMINDERS
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id UUID NOT NULL
        REFERENCES public.leads(id) ON DELETE RESTRICT,

    assigned_user UUID
        REFERENCES public.profiles(id) ON DELETE SET NULL,

    reminder_at TIMESTAMPTZ NOT NULL,
    note TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'cancelled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SYNC LOGS
CREATE TABLE public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    campaign_id UUID NOT NULL
        REFERENCES public.campaigns(id) ON DELETE RESTRICT,

    status VARCHAR(20) NOT NULL
        CHECK (status IN ('running', 'success', 'failed')),

    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 8. NOTIFICATIONS
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,

    message TEXT NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_profiles_client_id
    ON public.profiles(client_id);

CREATE INDEX idx_campaigns_client_id
    ON public.campaigns(client_id);

CREATE INDEX idx_campaigns_status
    ON public.campaigns(status);

CREATE INDEX idx_leads_campaign_id
    ON public.leads(campaign_id);

CREATE INDEX idx_leads_phone
    ON public.leads(phone_number);

CREATE INDEX idx_leads_created_time
    ON public.leads(created_time DESC);

CREATE INDEX idx_lead_activities_lead_id
    ON public.lead_activities(lead_id);

CREATE INDEX idx_reminders_lead_id
    ON public.reminders(lead_id);

CREATE INDEX idx_reminders_assigned_user
    ON public.reminders(assigned_user);

CREATE INDEX idx_reminders_due
    ON public.reminders(reminder_at)
    WHERE status = 'pending';

CREATE INDEX idx_sync_logs_campaign_id
    ON public.sync_logs(campaign_id);

CREATE INDEX idx_notifications_user_id
    ON public.notifications(user_id);

CREATE INDEX idx_notifications_unread
    ON public.notifications(user_id, created_at DESC)
    WHERE is_read = FALSE;