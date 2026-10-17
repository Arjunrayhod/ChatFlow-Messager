-- Chat IDs are deterministic strings created by the mobile client, not chats.id UUIDs.
-- Keep legacy rows while allowing new direct conversations to persist.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;
DROP POLICY IF EXISTS "Users can view messages in chats they belong to" ON public.messages;
ALTER TABLE public.messages ALTER COLUMN chat_id TYPE TEXT USING chat_id::text;
CREATE POLICY "Users can view messages in chats they belong to"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members cm
      JOIN public.users u ON cm.user_id = u.id
      WHERE cm.chat_id::text = messages.chat_id AND u.firebase_uid = auth.uid()::text
    )
  );

-- Persistent story feed and view history.
CREATE TABLE IF NOT EXISTS public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('text', 'image', 'video')),
  caption TEXT,
  background_color TEXT DEFAULT '#075E54',
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON public.statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON public.statuses(expires_at);
CREATE INDEX IF NOT EXISTS idx_statuses_created_at ON public.statuses(created_at DESC);

CREATE TABLE IF NOT EXISTS public.status_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_screenshotted BOOLEAN NOT NULL DEFAULT false,
  screenshotted_at TIMESTAMPTZ,
  CONSTRAINT unique_status_viewer UNIQUE(status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON public.status_views(status_id);
CREATE INDEX IF NOT EXISTS idx_status_views_viewer_id ON public.status_views(viewer_id);

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view active statuses of contacts" ON public.statuses;
DROP POLICY IF EXISTS "Users can insert their own status" ON public.statuses;
DROP POLICY IF EXISTS "Users can delete their own status" ON public.statuses;
DROP POLICY IF EXISTS "Users can record their view" ON public.status_views;
DROP POLICY IF EXISTS "Status owners can see who viewed" ON public.status_views;

CREATE POLICY "Users can view active statuses of contacts"
  ON public.statuses FOR SELECT
  USING (
    expires_at > now()
    AND (
      user_id = auth.uid()
      OR user_id IN (
        SELECT contact_user_id FROM public.contacts WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own status"
  ON public.statuses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own status"
  ON public.statuses FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can record their view"
  ON public.status_views FOR INSERT
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Status owners can see who viewed"
  ON public.status_views FOR SELECT
  USING (
    viewer_id = auth.uid()
    OR status_id IN (
      SELECT id FROM public.statuses WHERE user_id = auth.uid()
    )
  );
