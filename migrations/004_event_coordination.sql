-- Create enum for coordination status
CREATE TYPE coordination_status AS ENUM ('collecting_responses', 'analyzing', 'completed');

-- Create event coordination threads table
CREATE TABLE IF NOT EXISTS public.event_coordination_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    status coordination_status NOT NULL DEFAULT 'collecting_responses',
    created_by UUID REFERENCES auth.users(id),
    expected_responses INTEGER,
    response_timeout TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_event_coordination_message ON public.event_coordination_threads(message_id);
CREATE INDEX IF NOT EXISTS idx_event_coordination_channel ON public.event_coordination_threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_event_coordination_status ON public.event_coordination_threads(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_event_coordination_timestamp
    BEFORE UPDATE ON public.event_coordination_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add RLS policies
ALTER TABLE public.event_coordination_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
    ON public.event_coordination_threads
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users"
    ON public.event_coordination_threads
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Enable update for thread creator"
    ON public.event_coordination_threads
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM channel_members cm
            WHERE cm.channel_id = event_coordination_threads.channel_id
            AND cm.user_id = auth.uid()
        )
    ); 