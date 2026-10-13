ALTER TABLE public.gait_results
  ADD COLUMN IF NOT EXISTS engine_output jsonb,
  ADD COLUMN IF NOT EXISTS landmark_frames jsonb,
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;