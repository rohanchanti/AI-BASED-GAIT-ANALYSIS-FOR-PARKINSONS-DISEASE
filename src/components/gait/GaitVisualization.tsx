import { useMemo } from "react";
import {
  Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { Activity, AlertTriangle, CheckCircle2, Footprints, Gauge, Info, Ruler, Scale, Timer } from "lucide-react";
import type { AnalysisResult } from "@/lib/mock-analysis";
import type { PoseAnalysis } from "@/types/gait";

const AXIS = { stroke: "hsl(215 20% 65%)", fontSize: 11 };
const LEFT_COLOR = "#38BDF8";
const RIGHT_COLOR = "#C084FC";

/** Canonical stance/swing sub-phases of one gait cycle (Perry & Burnfield). */
const PHASES = [
  { name: "Heel Strike", span: "0%", phase: "Stance", note: "Initial contact — foot meets the ground" },
  { name: "Loading", span: "0–10%", phase: "Stance", note: "Weight acceptance, shock absorption" },
  { name: "Mid Stance", span: "10–30%", phase: "Stance", note: "Single-limb support over the foot" },
  { name: "Toe Off", span: "50–60%", phase: "Stance", note: "Terminal stance, push-off" },
  { name: "Swing", span: "60–100%", phase: "Swing", note: "Limb advances forward, no ground contact" },
  { name: "Heel Strike", span: "100%", phase: "Stance", note: "Cycle repeats on the same limb" },
] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs uppercase tracking-[0.2em] text-cyan mt-8 mb-3 first:mt-0">{children}</h3>;
}

function fmt(v: number | null | undefined, unit = "", digits = 2) {
  if (v == null || !isFinite(v)) return "Not available";
  return `${v.toFixed(digits)}${unit}`;
}

function MetricCard({
  label, value, unit, icon: Icon, sub,
}: {
  label: string; value: string; unit?: string; icon: React.ElementType; sub?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-cyan" aria-hidden />
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold gradient-text">
        {value}
        {unit && value !== "Not available" && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="ml-2 rounded-md border border-warning/50 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warning align-middle">
      Demo / example data
    </span>
  );
}

/** Textbook sagittal knee-angle template over one normalized gait cycle (example only). */
const DEMO_CYCLE = [
  5, 10, 17, 20, 18, 14, 10, 8, 7, 8, 12, 25, 42, 55, 62, 60, 48, 30, 15, 8, 5,
].map((knee, i) => ({ pct: i * 5, Left: knee, Right: knee }));

export function GaitVisualization({
  result,
  pose,
}: {
  result: AnalysisResult;
  pose?: PoseAnalysis | null;
}) {
  const p = (key: string) => result.parameters.find((x) => x.key === key);
  const val = (key: string) => p(key)?.patient ?? null;
  const status = (key: string) => p(key)?.status ?? null;

  const m = pose?.metrics ?? null;

  /* ---- Cycle-normalized knee trajectory from existing pose angle samples ---- */
  const cycleCurve = useMemo(() => {
    if (!pose?.cycles?.length || !pose.angles.length) return null;
    const bins = 21;
    const acc = {
      Left: Array.from({ length: bins }, () => [] as number[]),
      Right: Array.from({ length: bins }, () => [] as number[]),
    };
    for (const c of pose.cycles) {
      if (!(c.duration > 0)) continue;
      const key = c.side === "left" ? "Left" : "Right";
      const angleKey = c.side === "left" ? "leftKnee" : "rightKnee";
      for (const s of pose.angles) {
        if (s.timestamp < c.startTime || s.timestamp > c.endTime) continue;
        const a = s[angleKey];
        if (a == null || !isFinite(a)) continue;
        const idx = Math.min(bins - 1, Math.round(((s.timestamp - c.startTime) / c.duration) * (bins - 1)));
        acc[key][idx].push(a);
      }
    }
    const rows = Array.from({ length: bins }, (_, i) => ({
      pct: Math.round((i / (bins - 1)) * 100),
      Left: acc.Left[i].length ? acc.Left[i].reduce((a, b) => a + b, 0) / acc.Left[i].length : null,
      Right: acc.Right[i].length ? acc.Right[i].reduce((a, b) => a + b, 0) / acc.Right[i].length : null,
    }));
    const filled = rows.filter((r) => r.Left != null || r.Right != null).length;
    return filled >= bins * 0.6 ? rows : null;
  }, [pose]);

  const isDemoCurve = !cycleCurve;
  const curveData = cycleCurve ?? DEMO_CYCLE;

  /* ---- Left vs right limb comparison (pose-derived where available) ---- */
  const limbData = useMemo(() => {
    if (!m) return [];
    const kneeL = m.joints.leftKnee, kneeR = m.joints.rightKnee;
    const hipL = m.joints.leftHip, hipR = m.joints.rightHip;
    const ankL = m.joints.leftAnkle, ankR = m.joints.rightAnkle;
    return [
      { measure: "Step time (×100 s)", Left: m.leftStepTime != null ? m.leftStepTime * 100 : null, Right: m.rightStepTime != null ? m.rightStepTime * 100 : null },
      { measure: "Cycle time (×100 s)", Left: m.leftCycleDuration != null ? m.leftCycleDuration * 100 : null, Right: m.rightCycleDuration != null ? m.rightCycleDuration * 100 : null },
      { measure: "Knee ROM (°)", Left: kneeL?.rom ?? null, Right: kneeR?.rom ?? null },
      { measure: "Hip ROM (°)", Left: hipL?.rom ?? null, Right: hipR?.rom ?? null },
      { measure: "Ankle ROM (°)", Left: ankL?.rom ?? null, Right: ankR?.rom ?? null },
    ].filter((r) => r.Left != null || r.Right != null);
  }, [m]);

  /* ---- Interpretation strictly from measured rows ---- */
  const abnormal = result.parameters.filter((x) => x.status === "abnormal");
  const borderline = result.parameters.filter((x) => x.status === "borderline");

  const observed: string[] = [];
  const speed = val("walking_speed");
  const cad = val("cadence");
  const stride = val("stride_length");
  const sym = val("walking_sym");
  if (speed != null) observed.push(speed < 1.0 ? "Reduced walking speed (bradykinetic pattern)" : "Walking speed within the expected adult range");
  if (stride != null) observed.push(stride < 1.2 ? "Shortened stride length (shuffling tendency)" : "Stride length within the expected range");
  if (cad != null) observed.push(cad < 100 ? "Reduced cadence" : cad > 125 ? "Elevated cadence (possible festination)" : "Cadence within the expected range");
  if (sym != null) observed.push(sym < 90 ? "Asymmetric left-right gait pattern" : "Broadly symmetric left-right pattern");
  if (!observed.length) observed.push("Not available — no measured gait parameters for this session.");

  const keyMeasures = ["walking_speed", "cadence", "stride_length", "step_time", "stance_phase", "walking_sym"]
    .map((k) => p(k))
    .filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Gait Analysis Visualization</div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Spatiotemporal parameters, gait-cycle structure and limb comparison derived from this
            session's analysis. Research output — not a medical diagnosis.
          </p>
        </div>
      </div>

      {/* 1. Parameter cards */}
      <SectionTitle>Gait parameters</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Step count"
          value={m?.stepCount ? String(m.stepCount) : "Not available"}
          icon={Footprints}
          sub="Detected gait events"
        />
        <MetricCard label="Cadence" value={fmt(cad ?? m?.cadence ?? null, "", 1)} unit="steps/min" icon={Activity} />
        <MetricCard
          label="Step / stride time"
          value={val("step_time") != null ? `${fmt(val("step_time"), "", 2)} / ${fmt(val("stride_time"), "", 2)}` : fmt(m?.meanStepTime ?? null, "", 2)}
          unit="s"
          icon={Timer}
        />
        <MetricCard label="Walking speed" value={fmt(speed, "", 2)} unit="m/s" icon={Gauge} />
        <MetricCard label="Stride length" value={fmt(stride, "", 2)} unit="m" icon={Ruler} />
        <MetricCard
          label="Gait symmetry"
          value={fmt(sym ?? m?.overallSymmetryIndex ?? null, "", 1)}
          unit="%"
          icon={Scale}
        />
      </div>

      {/* 2. Gait cycle phases */}
      <SectionTitle>Gait cycle phases</SectionTitle>
      <div className="flex flex-wrap items-stretch gap-2">
        {PHASES.map((ph, i) => (
          <div key={`${ph.name}-${i}`} className="flex items-stretch gap-2">
            <div
              className={`min-w-[132px] rounded-xl border p-3 ${
                ph.phase === "Stance" ? "border-primary/40 bg-primary/5" : "border-accent/40 bg-accent/5"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{ph.phase} · {ph.span}</div>
              <div className="mt-0.5 text-sm font-medium">{ph.name}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{ph.note}</div>
            </div>
            {i < PHASES.length - 1 && (
              <div className="grid place-items-center text-muted-foreground" aria-hidden>→</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Stance phase" value={fmt(val("stance_phase") ?? m?.stancePct ?? null, "", 1)} unit="%" icon={Activity} />
        <MetricCard label="Swing phase" value={fmt(val("swing_phase") ?? m?.swingPct ?? null, "", 1)} unit="%" icon={Activity} />
        <MetricCard label="Double support" value={fmt(val("double_support") ?? m?.doubleSupportPct ?? null, "", 1)} unit="%" icon={Activity} />
        <MetricCard label="Gait cycle duration" value={fmt(val("gait_cycle") ?? m?.gaitCycleDuration ?? null, "", 2)} unit="s" icon={Timer} />
      </div>

      {/* 3. Cycle movement line chart */}
      <SectionTitle>
        Knee angle across the gait cycle
        {isDemoCurve && <DemoBadge />}
      </SectionTitle>
      <p className="mb-2 text-xs text-muted-foreground">
        {isDemoCurve
          ? "This session did not yield enough complete gait cycles, so a textbook example curve is shown for illustration only. It is not this subject's measurement."
          : "Measured knee flexion averaged over every detected gait cycle for this subject, normalized to 0–100% of the cycle."}
      </p>
      <div className="h-72 w-full" role="img" aria-label="Knee angle across one normalized gait cycle, left and right">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curveData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="hsl(230 25% 22%)" strokeDasharray="3 3" />
            <XAxis dataKey="pct" {...AXIS} unit="%" />
            <YAxis {...AXIS} unit="°" domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#0b1020", border: "1px solid #26304d", fontSize: 12 }}
              formatter={(v) => (v == null ? "n/a" : `${Number(v).toFixed(1)}°`)}
              labelFormatter={(l) => `${l}% of gait cycle`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Left" name="Left knee" stroke={LEFT_COLOR} dot={false} strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="Right" name="Right knee" stroke={RIGHT_COLOR} dot={false} strokeWidth={2} strokeDasharray="5 3" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Left vs right limb */}
      <SectionTitle>Left vs right limb</SectionTitle>
      {limbData.length ? (
        <>
          <div className="h-72 w-full" role="img" aria-label="Left versus right limb measurement comparison">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={limbData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="hsl(230 25% 22%)" strokeDasharray="3 3" />
                <XAxis dataKey="measure" {...AXIS} interval={0} tickLine={false} />
                <YAxis {...AXIS} />
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #26304d", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Left" fill={LEFT_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Right" fill={RIGHT_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 inline-flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Timing measures are scaled ×100 so seconds and degrees share one axis. Left-right
            differences above roughly 10% are commonly reported as asymmetric in gait literature.
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
          Not available — this session did not produce per-side pose measurements.
        </div>
      )}

      {/* 5. Interpretation */}
      <SectionTitle>Gait pattern interpretation</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 p-4">
          <div className="text-sm font-medium">Observed Pattern</div>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {observed.map((o) => (
              <li key={o} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border/60 p-4">
          <div className="text-sm font-medium">Key Measurements</div>
          <dl className="mt-2 space-y-1.5 text-xs">
            {keyMeasures.length ? (
              keyMeasures.map((row) => (
                <div key={row.key} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">{row.name}</dt>
                  <dd className="font-display">
                    {row.patient.toFixed(2)} {row.unit}
                    <span className="ml-1 text-[10px] uppercase text-muted-foreground">{row.status}</span>
                  </dd>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">Not available</div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-border/60 p-4">
          <div className="text-sm font-medium">Potential Abnormalities</div>
          {abnormal.length || borderline.length ? (
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {[...abnormal, ...borderline].slice(0, 6).map((row) => (
                <li key={row.key} className="flex items-start gap-2">
                  <AlertTriangle
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${row.status === "abnormal" ? "text-destructive" : "text-warning"}`}
                    aria-hidden
                  />
                  <span>
                    {row.name}: {row.patient.toFixed(2)} {row.unit} vs reference {row.range[0]}–{row.range[1]} {row.unit} — {row.interpretation}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No parameter fell outside its reference range in this session.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        These visualizations summarise measurements produced by the existing analysis pipeline. No
        value shown here is a clinical diagnosis, and any panel labelled as demo/example data is
        illustrative only.
      </p>
    </div>
  );
}
