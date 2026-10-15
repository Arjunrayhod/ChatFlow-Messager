-- =========================================================================
-- ChatFlow Database Schema: WhatsApp-style Ephemeral Statuses & Stories
-- with 24-Hour Expiration and Snapchat-style Screenshot Tracking
-- Strict Compliance with RULE 0.1: Strictly Zero Phone Numbers
-- =========================================================================

-- 1. Statuses Table
CREATE TABLE IF NOT EXISTS public.statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    media_url TEXT,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('text', 'image', 'video')),
    caption TEXT,
    background_color VARCHAR(30) DEFAULT '#075E54',
    duration_seconds INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '24 hours')
);

-- Indexes for lightning fast feed queries and expiration indexing
CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON public.statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON public.statuses(expires_at);
CREATE INDEX IF NOT EXISTS idx_statuses_created_at ON public.statuses(created_at DESC);

-- 2. Status Views Table (Tracks view counts, viewers list & screenshot detection)
CREATE TABLE IF NOT EXISTS public.status_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    has_screenshotted BOOLEAN NOT NULL DEFAULT false,
    screenshotted_at TIMESTAMPTZ,
    CONSTRAINT unique_status_viewer UNIQUE(status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON public.status_views(status_id);
CREATE INDEX IF NOT EXISTS idx_status_views_viewer_id ON public.status_views(viewer_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

-- Statuses Read Policy: Users can view their own statuses or active statuses of their contacts
CREATE POLICY "Users can view active statuses of contacts"
    ON public.statuses FOR SELECT
    USING (
        expires_at > timezone('utc'::text, now())
        AND (
            user_id = auth.uid()
            OR user_id IN (
                SELECT contact_user_id FROM public.contacts WHERE user_id = auth.uid()
            )
        )
    );

-- Statuses Insert Policy: Users can insert their own status
CREATE POLICY "Users can insert their own status"
    ON public.statuses FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Statuses Delete Policy: Users can delete only their own status
CREATE POLICY "Users can delete their own status"
    ON public.statuses FOR DELETE
    USING (user_id = auth.uid());

-- Status Views Policies
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

-- 4. Hourly Cleanup Function (deletes expired statuses older than 24 hours)
CREATE OR REPLACE FUNCTION delete_expired_statuses()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.statuses
    WHERE expires_at <= timezone('utc'::text, now());
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. pg_cron Schedule (Runs automatically every hour)
-- SELECT cron.schedule('cleanup-expired-statuses', '0 * * * *', 'SELECT delete_expired_statuses()');
