-- Migration 005: Track how campaign synchronization was triggered

ALTER TABLE public.sync_logs
ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20);

-- Preserve historical records without guessing their trigger source.
UPDATE public.sync_logs
SET trigger_type = 'legacy'
WHERE trigger_type IS NULL;

-- New sync records are manual unless explicitly marked scheduled.
ALTER TABLE public.sync_logs
ALTER COLUMN trigger_type SET DEFAULT 'manual';

ALTER TABLE public.sync_logs
ALTER COLUMN trigger_type SET NOT NULL;

-- Restrict values to supported trigger types.
ALTER TABLE public.sync_logs
DROP CONSTRAINT IF EXISTS sync_logs_trigger_type_check;

ALTER TABLE public.sync_logs
ADD CONSTRAINT sync_logs_trigger_type_check
CHECK (trigger_type IN ('manual', 'scheduled', 'legacy'));

-- Helpful index for filtering sync history.
CREATE INDEX IF NOT EXISTS idx_sync_logs_campaign_trigger_started
ON public.sync_logs (campaign_id, trigger_type, started_at DESC);