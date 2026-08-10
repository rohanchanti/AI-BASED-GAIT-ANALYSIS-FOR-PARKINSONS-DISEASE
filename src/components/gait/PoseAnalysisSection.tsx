import { useMemo, useState } from "react";
import {
  Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { AlertTriangle, Info, ScanLine } from "lucide-react";
import {
  JOINT_LABEL, POSE_QUALITY_FORMULA, SYMMETRY_FORMULA,
  type JointKey, type PoseAnalysis,
} from "@/types/gait";

const AXIS = { stroke: "hsl(215 20% 65%)", fontSize: 11 };
const LEFT_COLOR = "#38BDF8";
const RIGHT_COLOR = "#C084FC";

function fmt(v: number | null | undefined, unit = "", digits = 1) {
  if (v == null || !isFinite(v)) return "Insufficient data";
  return `${v.toFixed(digits)}${unit}`;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold gradient-text">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs uppercase tracking-[0.2em] text-cyan mt-8 mb-3">{children}</h3>;
}

const JOINT_TABS: { id: "Knee" | "Hip" | "Ankle"; left: JointKey; right: JointKey }[] = [
  { id: "Knee", left: "leftKnee", right: "rightKnee" },
  { id: "Hip", left: "leftHip", right: "rightHip" },
  { id: "Ankle", left: "leftAnkle", right: "rightAnkle" },
];

export function PoseAnalysisSection({
  analysis,
  pixelAvailable,
  pixelSummary,
}: {
  analysis: PoseAnalysis;
  pixelAvailable: boolean;
  pixelSummary?: { cadence?: number; symmetry?: number; stability?: number };
}) {
  const [tab, setTab] = useState<"Knee" | "Hip" | "Ankle">("Knee");
  const m = analysis.metrics;

  const series = useMemo(
    () =>
      analysis.angles.map((s) => ({
        t: +s.timestamp.toFixed(2),
        leftKnee: s.leftKnee,
        rightKnee: s.rightKnee,
        leftHip: s.leftHip,
        rightHip: s.rightHip,
        leftAnkle: s.leftAnkle,
        rightAnkle: s.rightAnkle,
      })),
    [analysis.angles],
  );

  const romData = useMemo(
    () =>
      (["Knee", "Hip", "Ankle"] as const).map((j) => {
        const t = JOINT_TABS.find((x) => x.id === j)!;
        return {
          joint: j,
          Left: m.joints[t.left]?.rom ?? null,
          Right: m.joints[t.right]?.rom ?? null,
        };
      }),
    [m.joints],
  );

  const meanData = useMemo(
    () =>
      (["Knee", "Hip", "Ankle"] as const).map((j) => {
        const t = JOINT_TABS.find((x) => x.id === j)!;
        return {
          joint: j,
          Left: m.joints[t.left]?.mean ?? null,
          Right: m.joints[t.right]?.mean ?? null,
        };
      }),
    [m.joints],
  );

  const eventData = useMemo(
    () =>
      analysis.events.map((e) => ({
        t: +e.timestamp.toFixed(2),
        y: e.side === "left" ? 1 : 2,
        label: `${e.side} ${e.type.replace("_", " ")}`,
        type: e.type,
      })),
    [analysis.events],
  );

  const active = JOINT_TABS.find((x) => x.id === tab)!;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">MediaPipe Pose Analysis</div>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Anatomical landmarks extracted in your browser with the MediaPipe Pose Landmarker,
            then converted to joint angles and algorithmic gait-event estimates.
            Research metric — not a clinical diagnosis.
          </p>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
          <ScanLine className="h-3.5 w-3.5 text-cyan" />
          {analysis.video.width}×{analysis.video.height} · {analysis.video.sampledFrames} frames @{" "}
          {analysis.video.sampledFps} fps
        </div>
      </div>

      {/* Analysis methods */}
      <SectionTitle>Analysis methods</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 p-4">
          <div className="text-sm font-medium">Motion Analysis — Pixel Difference</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Status: {pixelAvailable ? "Available" : "Not available"} · frame-differencing motion energy
          </div>
        </div>
        <div className="rounded-xl border border-primary/40 p-4">
          <div className="text-sm font-medium">Pose Analysis — MediaPipe</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Status: Available · 33 anatomical landmarks, joint geometry
          </div>
        </div>
      </div>

      {/* Top cards */}
      <SectionTitle>Pose gait metrics</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card label="Pose quality" value={fmt(m.poseQuality, "%")} sub={`threshold ${m.confidenceThreshold}`} />
        <Card label="Detected steps" value={m.stepCount ? String(m.stepCount) : "Insufficient data"} />
        <Card label="Cadence" value={fmt(m.cadence, " steps/min")} />
        <Card label="Gait cycle" value={fmt(m.gaitCycleDuration, " s", 2)} />
        <Card
          label="Knee symmetry"
          value={fmt(m.symmetry.find((s) => s.label === "Knee ROM")?.index ?? null, "%")}
        />
        <Card label="Analysis duration" value={fmt(m.analysisDurationSec, " s", 2)} />
      </div>

      {/* Joint analysis */}
      <SectionTitle>Joint analysis</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(JOINT_LABEL) as JointKey[]).map((k) => {
          const st = m.joints[k];
          return (
            <div key={k} className="rounded-xl border border-border/60 p-4">
              <div className="text-sm font-medium">{JOINT_LABEL[k]}</div>
              {st ? (
                <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                  {([["Mean", st.mean], ["Min", st.min], ["Max", st.max], ["ROM", st.rom]] as const).map(
                    ([lbl, v]) => (
                      <div key={lbl}>
                        <dt className="text-[10px] uppercase text-muted-foreground">{lbl}</dt>
                        <dd className="font-display text-base">{v.toFixed(1)}°</dd>
                      </div>
                    ),
                  )}
                </dl>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">Not available from this video</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Joint angle time series */}
      <SectionTitle>Joint angle analysis</SectionTitle>
      <div className="flex gap-2" role="tablist" aria-label="Joint angle charts">
        {JOINT_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              tab === t.id ? "border-primary text-foreground" : "border-border/60 text-muted-foreground"
            }`}
          >
            {t.id}
          </button>
        ))}
      </div>
      <div className="mt-3 h-72 w-full" role="img" aria-label={`Left and right ${tab.toLowerCase()} angle over time in degrees`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="hsl(230 25% 22%)" strokeDasharray="3 3" />
            <XAxis dataKey="t" {...AXIS} unit="s" />
            <YAxis {...AXIS} unit="°" domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#0b1020", border: "1px solid #26304d", fontSize: 12 }}
              formatter={(v: number | null) => (v == null ? "n/a" : `${Number(v).toFixed(1)}°`)}
              labelFormatter={(l) => `t = ${l}s`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey={active.left} name={`Left ${tab}`} stroke={LEFT_COLOR} dot={false} strokeWidth={2} connectNulls={false} />
            <Line type="monotone" dataKey={active.right} name={`Right ${tab}`} stroke={RIGHT_COLOR} dot={false} strokeWidth={2} strokeDasharray="5 3" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gait timing + events */}
      <SectionTitle>Gait timing — algorithmic gait-event estimation</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Mean step time" value={fmt(m.meanStepTime, " s", 2)} />
        <Card label="Left step time" value={fmt(m.leftStepTime, " s", 2)} />
        <Card label="Right step time" value={fmt(m.rightStepTime, " s", 2)} />
        <Card label="Detected events" value={String(analysis.events.length)} />
      </div>
      <div className="mt-3 h-48 w-full" role="img" aria-label="Timeline of estimated heel strike and toe off events per side">
        {eventData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="hsl(230 25% 22%)" strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" {...AXIS} unit="s" />
              <YAxis
                dataKey="y" type="number" domain={[0, 3]} ticks={[1, 2]}
                tickFormatter={(v) => (v === 1 ? "Left" : "Right")} {...AXIS}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                contentStyle={{ background: "#0b1020", border: "1px solid #26304d", fontSize: 12 }}
                formatter={(_v, _n, p) => (p?.payload as { label: string })?.label ?? ""}
              />
              <Scatter data={eventData.filter((e) => e.type === "heel_strike")} name="Heel strike ▲" fill={LEFT_COLOR} shape="triangle" />
              <Scatter data={eventData.filter((e) => e.type === "toe_off")} name="Toe off ●" fill={RIGHT_COLOR} shape="circle" />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            Insufficient pose quality for reliable gait-event estimation.
          </div>
        )}
      </div>

      {/* Symmetry */}
      <SectionTitle>Left-right gait symmetry index</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">Measure</th>
              <th className="py-2 pr-3">Left</th>
              <th className="py-2 pr-3">Right</th>
              <th className="py-2 pr-3">Difference</th>
              <th className="py-2 pr-3">Symmetry index</th>
              <th className="py-2">Interpretation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {m.symmetry.map((s) => {
              const substantial = s.index != null && s.index < 85;
              return (
                <tr key={s.label}>
                  <td className="py-2 pr-3">{s.label}</td>
                  <td className="py-2 pr-3">{fmt(s.left, s.unit, 2)}</td>
                  <td className="py-2 pr-3">{fmt(s.right, s.unit, 2)}</td>
                  <td className="py-2 pr-3">{fmt(s.difference, s.unit, 2)}</td>
                  <td className={`py-2 pr-3 ${substantial ? "text-warning font-medium" : ""}`}>
                    {fmt(s.index, "%")}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {s.index == null
                      ? "Not available"
                      : substantial
                        ? "⚠ Substantial left-right difference observed"
                        : "Left and right values closely matched"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground inline-flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {SYMMETRY_FORMULA} Overall index: {fmt(m.overallSymmetryIndex, "%")}. Research metric — not a
        clinical diagnosis.
      </p>

      {/* ROM + mean comparison charts */}
      <SectionTitle>Left vs right comparison</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: "Range of motion (°)", data: romData, label: "Left versus right range of motion per joint" },
          { title: "Mean joint angle (°)", data: meanData, label: "Left versus right mean joint angle" },
        ].map((c) => (
          <div key={c.title} className="h-64" role="img" aria-label={c.label}>
            <div className="text-xs text-muted-foreground mb-1">{c.title}</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="hsl(230 25% 22%)" strokeDasharray="3 3" />
                <XAxis dataKey="joint" {...AXIS} />
                <YAxis {...AXIS} unit="°" />
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #26304d", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Left" fill={LEFT_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Right" fill={RIGHT_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Relative spatial */}
      <SectionTitle>Spatial estimates — pixel-space (uncalibrated)</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card label="Relative step length" value={fmt(m.relativeStepLength, " (norm. units)", 3)} sub="Relative measurement — not metres" />
        <Card label="Relative walking speed" value={fmt(m.relativeWalkingSpeed, " units/s", 3)} sub="Pixel-space estimate" />
        <Card label="Camera view" value={m.cameraView === "unknown" ? "Unknown" : m.cameraView} sub="Side view preferred for sagittal analysis" />
      </div>

      {/* Method comparison */}
      {pixelAvailable && (
        <>
          <SectionTitle>Compare analysis methods</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3">Pixel difference</th>
                  <th className="py-2">MediaPipe pose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="py-2 pr-3">Cadence (steps/min)</td>
                  <td className="py-2 pr-3">{fmt(pixelSummary?.cadence ?? null)}</td>
                  <td className="py-2">{fmt(m.cadence)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Symmetry (%)</td>
                  <td className="py-2 pr-3">{fmt(pixelSummary?.symmetry ?? null)}</td>
                  <td className="py-2">{fmt(m.overallSymmetryIndex)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Motion consistency</td>
                  <td className="py-2 pr-3">{fmt(pixelSummary?.stability ?? null, "%")}</td>
                  <td className="py-2">{fmt(m.poseQuality, "%")} usable frames</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Pixel-difference values describe whole-frame motion energy; MediaPipe values describe
            anatomical landmark geometry. They are different measurement modalities and are shown
            side by side for reference only, not as equivalent measurements.
          </p>
        </>
      )}

      {/* Quality control */}
      <SectionTitle>Quality control</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Pose detection quality" value={fmt(m.poseQuality, "%")} />
        <Card label="Usable frames" value={String(m.usableFrames)} />
        <Card label="Missing frames" value={String(m.missingFrames)} />
        <Card label="Confidence threshold" value={m.confidenceThreshold.toFixed(2)} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{POSE_QUALITY_FORMULA}</p>
      {m.warnings.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Analysis warnings">
          {m.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-hidden />
              <span>Warning: {w}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
        These measurements are computational gait-analysis outputs intended for research and
        educational use. They are not a medical diagnosis and should not be used as a substitute for
        clinical assessment.
      </p>
    </div>
  );
}
