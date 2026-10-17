-- Chat controls: disappearing messages, edit history, per-user deletion, pins,
-- scheduled messages, expense splits, and collaborative notes/tasks.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_expires_at
  ON public.messages(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_preferences (
  chat_id TEXT PRIMARY KEY,
  disappearing_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (disappearing_seconds IN (0, 86400, 604800, 7776000)),
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_hidden_for (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  chat_id TEXT NOT NULL,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, message_id)
);

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  metadata JSONB,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
  ON public.scheduled_messages(send_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.chat_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  paid_by TEXT NOT NULL,
  split_between TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  title TEXT NOT NULL,
  body TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_hidden_for ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_tasks ENABLE ROW LEVEL SECURITY;

-- ChatFlow accesses these tables through its authenticated API using the
-- Supabase service role. No client-side table access is granted here.
