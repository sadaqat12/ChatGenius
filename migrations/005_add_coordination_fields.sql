-- Add new columns to existing event_coordination_threads table
ALTER TABLE public.event_coordination_threads
ADD COLUMN IF NOT EXISTS expected_responses INTEGER,
ADD COLUMN IF NOT EXISTS response_timeout TIMESTAMPTZ;

-- Update existing records with default values
UPDATE public.event_coordination_threads
SET expected_responses = 2,  -- Default minimum of 2 responses
    response_timeout = created_at + INTERVAL '24 hours'  -- 24 hours from creation
WHERE expected_responses IS NULL
  AND response_timeout IS NULL
  AND status = 'collecting_responses';  -- Only update active threads 