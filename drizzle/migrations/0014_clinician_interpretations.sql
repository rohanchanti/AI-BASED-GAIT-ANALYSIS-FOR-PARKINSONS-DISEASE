CREATE TABLE public.clinician_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  comments text,
  interpretation text NOT NULL CHECK (length(btrim(interpretation)) BETWEEN 1 AND 5000),
  supersedes uuid REFERENCES public.clinician_interpretations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (comments IS NULL OR length(comments) <= 5000)
);
GRANT SELECT, INSERT ON public.clinician_interpretations TO authenticated;
GRANT ALL ON public.clinician_interpretations TO service_role;
ALTER TABLE public.clinician_interpretations ENABLE ROW LEVEL SECURITY;
CREATE INDEX clinician_interpretations_run_idx ON public.clinician_interpretations (run_id, created_at DESC);

CREATE POLICY "Read interpretations on own analyses" ON public.clinician_interpretations
FOR SELECT TO authenticated USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid())
);
CREATE POLICY "Add interpretation to own analyses" ON public.clinician_interpretations
FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid()))
);