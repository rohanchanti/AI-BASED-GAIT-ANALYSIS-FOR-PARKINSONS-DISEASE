ALTER TABLE public.analysis_runs ADD COLUMN IF NOT EXISTS model_name text, ADD COLUMN IF NOT EXISTS pipeline_version text, ADD COLUMN IF NOT EXISTS parameters jsonb, ADD COLUMN IF NOT EXISTS quality_metrics jsonb;
UPDATE public.analysis_runs SET pipeline_version = feature_pipeline_version WHERE pipeline_version IS NULL;
UPDATE public.analysis_runs a SET parameters = COALESCE(g.engine_output->'parameters', g.parameters), quality_metrics = COALESCE(g.quality, a.quality_report) FROM public.gait_results g WHERE g.run_id = a.id;
CREATE TABLE public.gait_features (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 analysis_run_id uuid NOT NULL REFERENCES public.analysis_runs(id),
 name text NOT NULL,
 value double precision,
 unit text NOT NULL,
 status text NOT NULL CHECK (status IN ('measured','estimated','unavailable','unreliable')),
 method text NOT NULL,
 UNIQUE (analysis_run_id, name),
 CHECK (status <> 'unavailable' OR value IS NULL)
);
GRANT SELECT, INSERT ON public.gait_features TO authenticated;
GRANT ALL ON public.gait_features TO service_role;
ALTER TABLE public.gait_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads gait features" ON public.gait_features FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = analysis_run_id AND a.owner_id = auth.uid()));
CREATE POLICY "Owner inserts gait features" ON public.gait_features FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.analysis_runs a WHERE a.id = analysis_run_id AND a.owner_id = auth.uid() AND a.status IN ('processing','running')));
CREATE FUNCTION public.protect_analysis_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF OLD.status IN ('complete','completed','completed_with_warnings','failed','needs_better_video','cancelled') AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'A finished analysis is immutable; create a new run for reanalysis.';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_analysis_history BEFORE UPDATE ON public.analysis_runs FOR EACH ROW EXECUTE FUNCTION public.protect_analysis_history();
CREATE FUNCTION public.persist_gait_feature_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 UPDATE public.analysis_runs SET parameters = COALESCE(NEW.engine_output->'parameters', NEW.parameters), quality_metrics = COALESCE(NEW.quality, quality_report) WHERE id = NEW.run_id;
 INSERT INTO public.gait_features (analysis_run_id, name, value, unit, status, method)
 SELECT NEW.run_id, p->>'key', CASE WHEN p->>'status' = 'unavailable' THEN NULL ELSE (p->>'value')::double precision END,
 COALESCE(p->>'unit',''), CASE WHEN p->>'value' IS NULL THEN 'unavailable' WHEN p->>'status' = 'experimental' THEN 'unreliable' WHEN p->>'status' IN ('measured','estimated','unreliable') THEN p->>'status' ELSE 'unreliable' END,
 COALESCE(p->>'method', 'Method not recorded')
 FROM jsonb_array_elements(COALESCE(NEW.engine_output->'parameters','[]'::jsonb)) p;
 RETURN NEW;
END;
$$;
CREATE TRIGGER persist_gait_feature_snapshot AFTER INSERT ON public.gait_results FOR EACH ROW EXECUTE FUNCTION public.persist_gait_feature_snapshot();
CREATE FUNCTION public.protect_gait_result_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 RAISE EXCEPTION 'Stored gait results are immutable; create a new analysis run.';
END;
$$;
CREATE TRIGGER protect_gait_result_history BEFORE UPDATE OR DELETE ON public.gait_results FOR EACH ROW EXECUTE FUNCTION public.protect_gait_result_history();
CREATE TRIGGER protect_gait_feature_history BEFORE UPDATE OR DELETE ON public.gait_features FOR EACH ROW EXECUTE FUNCTION public.protect_gait_result_history();