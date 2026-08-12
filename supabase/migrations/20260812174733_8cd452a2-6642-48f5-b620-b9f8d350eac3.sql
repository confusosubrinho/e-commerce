ALTER TABLE public.homepage_testimonials_config
  ADD COLUMN IF NOT EXISTS show_google_summary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_reviews_count integer,
  ADD COLUMN IF NOT EXISTS google_profile_url text;