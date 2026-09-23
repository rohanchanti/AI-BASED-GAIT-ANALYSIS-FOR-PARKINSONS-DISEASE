import { CheckCircle2, Brain, Ruler, ScanSearch, MessageSquareText } from "lucide-react";
import type { AnalysisResult, ParameterRow } from "@/lib/mock-analysis";
import type { PoseAnalysis } from "@/types/gait";
import { formatAnalysisDate } from "@/lib/analysis-version";

interface Props {
  result: AnalysisResult;
  pose: PoseAnalysis | null;
  analysisId?: string | null;
  analysisTimestamp?: string | null;
}

type BadgeKind = "measured" | "interpretation" | "demo";

function DataBadge({ kind }: { kind: BadgeKind }) {
  const styles: Record<BadgeKind, string> = {
    measured: "border-cyan/40 bg-cyan/10 text-cyan",
    interpretation: "border-violet-400/40 bg-violet-400/10 text-violet-300",
    demo: "border-warning/40 bg-warning/10 text-warning",
  };
  const labels: Record<BadgeKind, string> = {
    measured: "Measured data",
    interpretation: "AI-derived interpretation",
    demo: "Demo / example data",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[kind]}`}>
      {labels[kind]}
    </span>
  );
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

/**
 * "AI Analysis Results" presentation section. Renders only data that already
 * exists in the analysis result / pose session — nothing is synthesized.
 */
export function AIAnalysisResults({ result, pose, analysisId, analysisTimestamp }: Props) {
  const params = result.parameters;
  const flagged = params.filter((p) => p.status !== "normal");

  // Key detected parameters: prefer clinically flagged rows, else first rows.
  const keyParams: ParameterRow[] = (flagged.length > 0 ? flagged : params).slice(0, 6);

  const measurement = (key: string) => params.find((p) => p.key === key);

  // Movement / gait assessment rows — all from existing data sources.
  const movementRows: { label: string; value: string; source: "pose" | "pixel" }[] = [];
  const push = (label: string, value: string, source: "pose" | "pixel") =>
    movementRows.push({ label, value, source });

  if (pose) {
    push("Step count", String(pose.metrics.stepCount), "pose");
    if (pose.cycles) push("Valid gait cycles", String(pose.cycles.length), "pose");
    if (pose.metrics.cadence != null) push("Pose cadence", `${fmt(pose.metrics.cadence, 1)} steps/min`, "pose");
    push("Left step time", `${fmt(pose.metrics.leftStepTime, 3)} s`, "pose");
    push("Right step time", `${fmt(pose.metrics.rightStepTime, 3)} s`, "pose");
    if (pose.metrics.stancePct != null) push("Stance phase", `${fmt(pose.metrics.stancePct, 1)}%`, "pose");
    if (pose.metrics.doubleSupportPct != null)
      push("Double support", `${fmt(pose.metrics.doubleSupportPct, 1)}%`, "pose");
    push("Pose symmetry index", fmt(pose.metrics.overallSymmetryIndex, 1), "pose");
  }
  const cadence = measurement("cadence");
  if (cadence) push("Cadence", `${fmt(cadence.patient, 1)} steps/min`, "pixel");
  const speed = measurement("walking_speed");
  if (speed) push("Walking speed", `${fmt(speed.patient, 2)} m/s`, "pixel");
  const sym = measurement("walking_sym");
  if (sym) push("Movement symmetry", `${fmt(sym.patient, 1)}%`, "pixel");

  // Detected features: parameters outside the healthy reference range.
  const detectedFeatures = flagged;

  // AI interpretation: reuse existing per-parameter interpretations and
  // summary assessments — wording already avoids diagnostic claims.
  const interpretationLines: string[] = [];
  interpretationLines.push(
    `Overall gait health score ${result.summary.overallGaitHealth.toFixed(0)}/100 with ` +
      `${result.summary.counts.normal} normal, ${result.summary.counts.borderline} borderline and ` +
      `${result.summary.counts.abnormal} abnormal parameters across ${params.length} gait features.`,
  );
  interpretationLines.push(`Balance: ${result.summary.assessments.balance}`);
  interpretationLines.push(`Mobility: ${result.summary.assessments.mobility}`);
  interpretationLines.push(`Symmetry: ${result.summary.assessments.symmetry}`);
  interpretationLines.push(`Stability: ${result.summary.assessments.stability}`);

  const hasConfidence =
    typeof result.summary.confidence === "number" && Number.isFinite(result.summary.confidence);

  return (
    <section className="space-y-5">
      {/* Header: status + session identifier */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Analysis Complete
          </span>
          <h2 className="font-display text-lg font-semibold">AI Analysis Results</h2>
        </div>
        {(analysisId || analysisTimestamp) && (
          <div className="text-[11px] text-muted-foreground">
            {analysisId && <span className="font-mono text-foreground/80">{analysisId}</span>}
            {analysisId && analysisTimestamp && " · "}
            {analysisTimestamp && <span>{formatAnalysisDate(analysisTimestamp)}</span>}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        Research screening of movement characteristics and gait features. These analysis findings
        are not a diagnosis of Parkinson&apos;s disease or any other condition.
      </p>

      {/* Key detected parameters */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="h-4 w-4 text-cyan" />
          <h3 className="text-sm font-semibold">Key Detected Parameters</h3>
          <DataBadge kind="measured" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {keyParams.map((p) => (
            <div key={p.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] text-muted-foreground truncate">{p.name}</div>
              <div className="mt-1 font-display text-lg font-semibold">
                {fmt(p.patient)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Reference {fmt(p.range[0])}–{fmt(p.range[1])} {p.unit}
              </div>
              <div
                className={`mt-1 text-[11px] font-medium ${
                  p.status === "normal" ? "text-success" : p.status === "borderline" ? "text-warning" : "text-danger"
                }`}
              >
                {p.status === "normal" ? "Within range" : p.status === "borderline" ? "Borderline" : "Outside range"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Movement / gait assessment panel */}
      {movementRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ScanSearch className="h-4 w-4 text-cyan" />
            <h3 className="text-sm font-semibold">Movement / Gait Assessment</h3>
            <DataBadge kind="measured" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Measure</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {movementRows.map((r) => (
                  <tr key={r.label} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                    <td className="px-3 py-2 font-medium">{r.value}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {r.source === "pose" ? "Pose landmarks" : "Video motion analysis"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detected features */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-cyan" />
          <h3 className="text-sm font-semibold">Detected Features</h3>
          <DataBadge kind="measured" />
        </div>
        {detectedFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All measured gait features fall within their healthy reference ranges in this session.
          </p>
        ) : (
          <ul className="space-y-2">
            {detectedFeatures.map((p) => (
              <li
                key={p.key}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    p.status === "borderline" ? "bg-warning" : "bg-danger"
                  }`}
                />
                <div className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — measured {fmt(p.patient)} {p.unit} vs reference {fmt(p.range[0])}–{fmt(p.range[1])} {p.unit}
                    {" "}({p.deviationPct >= 0 ? "+" : ""}{fmt(p.deviationPct, 1)}% deviation)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI interpretation */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareText className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold">AI Interpretation</h3>
          <DataBadge kind="interpretation" />
        </div>
        <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-4 space-y-2">
          {interpretationLines.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/85">
              {line}
            </p>
          ))}
          {hasConfidence && (
            <p className="text-[11px] text-muted-foreground">
              Model confidence for this run: {(result.summary.confidence * 100).toFixed(1)}%.
              This reflects internal model certainty only — it is an uncalibrated research output,
              not a probability of any disease.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">{result.summary.recommendation}</p>
        </div>
      </div>
    </section>
  );
}
