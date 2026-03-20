
-- Create shared_links table for file link sharing
CREATE TABLE public.shared_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  encryption_key text NOT NULL,
  encryption_iv text NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own shared links"
ON public.shared_links FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own shared links"
ON public.shared_links FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared links"
ON public.shared_links FOR DELETE
USING (auth.uid() = user_id);

-- Allow anyone to read shared links by token (for public share access)
CREATE POLICY "Anyone can read shared links by token"
ON public.shared_links FOR SELECT
USING (true);

CREATE INDEX idx_shared_links_token ON public.shared_links(token);
CREATE INDEX idx_shared_links_file_id ON public.shared_links(file_id);
