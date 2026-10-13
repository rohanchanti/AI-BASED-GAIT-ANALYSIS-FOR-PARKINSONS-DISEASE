ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS clinical_history text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visit_code text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS protocol text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS consent_id uuid REFERENCES public.consents(id);
CREATE UNIQUE INDEX IF NOT EXISTS visits_visit_code_key ON public.visits(visit_code) WHERE visit_code IS NOT NULL;
ALTER TABLE public.clinician_reviews ADD COLUMN IF NOT EXISTS supersedes uuid REFERENCES public.clinician_reviews(id);

CREATE SEQUENCE IF NOT EXISTS public.visit_code_seq;
CREATE OR REPLACE FUNCTION public.tg_visit_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.visit_code IS NULL THEN
    NEW.visit_code := 'V-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.visit_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS visits_code ON public.visits;
CREATE TRIGGER visits_code BEFORE INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION public.tg_visit_code();

-- Protocol timing (TUG / 10MWT)
CREATE TABLE public.protocol_timings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id),
  protocol text NOT NULL,
  start_sec numeric NOT NULL,
  end_sec numeric NOT NULL,
  distance_m numeric,
  method text NOT NULL,
  verified_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.protocol_timings TO authenticated;
GRANT ALL ON public.protocol_timings TO service_role;
ALTER TABLE public.protocol_timings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads timings" ON public.protocol_timings FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner adds timings" ON public.protocol_timings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND verified_by = auth.uid() AND EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid()));

-- Clinical reports (append-only snapshots)
CREATE TABLE public.clinical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  visit_id uuid NOT NULL REFERENCES public.visits(id),
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.clinical_reports TO authenticated;
GRANT ALL ON public.clinical_reports TO service_role;
ALTER TABLE public.clinical_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads clinical reports" ON public.clinical_reports FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner adds clinical reports" ON public.clinical_reports FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = run_id AND a.owner_id = auth.uid() AND a.status IN ('completed','completed_with_warnings')));

-- Research
CREATE TABLE public.research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_code text NOT NULL,
  title text NOT NULL,
  description text,
  inclusion_criteria text,
  exclusion_criteria text,
  protocol jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'exploratory',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, project_code)
);
GRANT SELECT, INSERT, UPDATE ON public.research_projects TO authenticated;
GRANT ALL ON public.research_projects TO service_role;
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads projects" ON public.research_projects FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Researchers create projects" ON public.research_projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (public.has_role(auth.uid(), 'researcher') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Owner updates projects" ON public.research_projects FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.research_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.research_projects(id),
  participant_code text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id),
  included boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  split text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, participant_code)
);
CREATE TABLE public.research_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.research_projects(id),
  name text NOT NULL,
  source text NOT NULL,
  version text NOT NULL,
  checksum text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.research_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.research_projects(id),
  participant_id uuid NOT NULL REFERENCES public.research_participants(id),
  run_id uuid REFERENCES public.analysis_runs(id),
  parameter_key text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.research_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.research_projects(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  preprocessing jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.research_participants, public.research_datasets, public.research_annotations, public.research_experiments TO authenticated;
GRANT ALL ON public.research_participants, public.research_datasets, public.research_annotations, public.research_experiments TO service_role;
ALTER TABLE public.research_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages participants" ON public.research_participants FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owner manages datasets" ON public.research_datasets FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owner manages annotations" ON public.research_annotations FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owner manages experiments" ON public.research_experiments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Admins read participants" ON public.research_participants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read datasets" ON public.research_datasets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read annotations" ON public.research_annotations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read experiments" ON public.research_experiments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
