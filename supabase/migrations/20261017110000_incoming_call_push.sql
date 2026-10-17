-- Push delivery registration and recoverable WebRTC offers for incoming calls.
-- Push tokens are private to the authenticated account and accessed by the API service role.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  expo_push_token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS offer_sdp JSONB;

-- The backend uses its Supabase service role; no public/client policies are granted.
