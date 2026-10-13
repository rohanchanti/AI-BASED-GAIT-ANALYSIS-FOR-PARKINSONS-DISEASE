ALTER TABLE public.analysis_runs DROP CONSTRAINT IF EXISTS analysis_runs_status_check;
ALTER TABLE public.analysis_runs ADD CONSTRAINT analysis_runs_status_check CHECK (status IN ('running','complete','failed','queued','uploading','processing','completed','completed_with_warnings','cancelled'));
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS progress numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_key text,
  ADD COLUMN IF NOT EXISTS quality_report jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS analysis_runs_owner_session_key ON public.analysis_runs(owner_id, session_key) WHERE session_key IS NOT NULL;
ALTER TABLE public.recordings DROP CONSTRAINT IF EXISTS recordings_processing_status_check;
ALTER TABLE public.recordings ADD CONSTRAINT recordings_processing_status_check CHECK (processing_status IN ('pending','processing','complete','failed','rejected','uploading','uploaded','verified'));
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS protocol text,
  ADD COLUMN IF NOT EXISTS trial_number integer,
  ADD COLUMN IF NOT EXISTS deviations text,
  ADD COLUMN IF NOT EXISTS protocol_checks jsonb;
ALTER TABLE public.gait_results ADD COLUMN IF NOT EXISTS result_payload jsonb;
CREATE POLICY "Own recordings update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);