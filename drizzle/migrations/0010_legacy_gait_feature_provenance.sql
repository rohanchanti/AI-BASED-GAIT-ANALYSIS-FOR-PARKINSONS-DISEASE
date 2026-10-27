CREATE OR REPLACE FUNCTION public.persist_gait_feature_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 UPDATE public.analysis_runs SET parameters = COALESCE(NEW.engine_output->'parameters', NEW.parameters), quality_metrics = COALESCE(NEW.quality, quality_report) WHERE id = NEW.run_id;
 INSERT INTO public.gait_features (analysis_run_id, name, value, unit, status, method)
 SELECT NEW.run_id, COALESCE(p->>'key',p->>'name'),
 CASE WHEN p->>'status' = 'unavailable' THEN NULL ELSE COALESCE(p->>'value',p->>'patient')::double precision END,
 COALESCE(p->>'unit',''),
 CASE WHEN p->>'status' = 'unavailable' OR COALESCE(p->>'value',p->>'patient') IS NULL THEN 'unavailable' WHEN p->>'status' IN ('measured','estimated','unreliable') THEN p->>'status' ELSE 'unreliable' END,
 COALESCE(p->>'method', 'Method not recorded')
 FROM jsonb_array_elements(COALESCE(NEW.engine_output->'parameters', NEW.parameters, '[]'::jsonb)) p;
 RETURN NEW;
END;
$$;