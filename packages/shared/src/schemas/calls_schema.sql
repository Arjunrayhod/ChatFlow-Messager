-- ==============================================================================
-- ChatFlow Calls Schema (Phase 5: WebRTC 1-on-1 Voice & Video Calling)
-- Enforces RULE 0.1: STRICTLY ZERO PHONE NUMBERS, NO MOBILE, NO MSISDN COLUMNS
-- Identity is strictly anchored to user UUIDs & @usernames
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.calls (
  id TEXT PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  caller_username TEXT NOT NULL,
  caller_display_name TEXT NOT NULL,
  caller_avatar_url TEXT,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_username TEXT NOT NULL,
  receiver_display_name TEXT NOT NULL,
  receiver_avatar_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
  status TEXT NOT NULL CHECK (status IN ('ringing', 'connected', 'ended', 'rejected', 'busy', 'missed')),
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON public.calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls(started_at DESC);
