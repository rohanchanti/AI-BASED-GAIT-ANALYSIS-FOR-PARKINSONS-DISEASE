import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";

/** Add storage provenance without changing computed values or their classifications. */
export function withFeatureMethods(engine: any) {
  if (!engine || !Array.isArray(engine.parameters)) return engine;
  return {
    ...engine,
    parameters: engine.parameters.map((p: any) => {
      const definition = PARAMETER_DEFINITIONS.find((d) => d.key === p.key);
      return { ...p, unit: definition?.unit ?? "", method: definition ? `${definition.formula}; inputs: ${definition.inputs}` : "Method not recorded" };
    }),
  };
}

export function shouldCreateReanalysis(status: string, retry?: boolean) {
  return retry === true && ["complete", "completed", "completed_with_warnings", "failed", "cancelled"].includes(status);
}