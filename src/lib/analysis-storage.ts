import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";

/** Status updates/retries need metadata, never the stored measurement/quality snapshots. */
export const JOB_STATUS_COLUMNS = "id, owner_id, recording_id, status, attempts, analysis_mode, model_name, model_version, pipeline_version, feature_pipeline_version, pose_estimator_version, platform_version, preprocessing_config";

/** Add storage provenance without changing computed values or their classifications. */
export function withFeatureMethods(engine: any) {
  if (!engine || !Array.isArray(engine.parameters)) return engine;
  return {
    ...engine,
    parameters: engine.parameters.map((p: any) => {
      const definition = PARAMETER_DEFINITIONS.find((d) => d.key === p.key);
      return { ...p, unit: p.unit ?? definition?.unit ?? "", method: p.method ?? (definition ? `${definition.formula}; inputs: ${definition.inputs}` : "Method not recorded") };
    }),
  };
}

export function shouldCreateReanalysis(status: string, retry?: boolean) {
  return retry === true && ["complete", "completed", "completed_with_warnings", "failed", "cancelled"].includes(status);
}