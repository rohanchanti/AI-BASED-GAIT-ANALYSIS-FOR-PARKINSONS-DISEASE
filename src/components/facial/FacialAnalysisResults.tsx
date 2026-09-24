import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Eye, ScanFace, Sparkles } from "lucide-react";
import type { AnalysisResult, ParameterRow } from "@/lib/mock-analysis";

const GROUPS = [
  {
    title: "Facial symmetry",
    icon: ScanFace,
    keys: ["facial_symmetry", "smile_asymmetry"],
  },
  {
    title: "Blink-related measurements",
    icon: Eye,
    keys: ["blink_rate", "eye_closure"],
  },
  {
    title: "Movement amplitude",
    icon: Activity,
    keys: ["jaw_movement", "emotion_stability"],
  },
  {
    title: "Temporal characteristics",
    icon: Sparkles,
    keys: ["head_tremor", "micro_expr"],
  },
] as const;

const STATUS_STYLE = {
  normal: "border-success/40 bg-success/5 text-success",
  borderline: "border-warning/40 bg-warning/5 text-warning",
  abnormal: "border-danger/40 bg-danger/5 text-danger",
} as const;

function DemoBadge() {
  return (
    <span className="rounded-md border border-warning/50 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warning">
      Demo / example data
    </span>
  );
}

function fmt(row: ParameterRow) {
  return `${row.patient.toFixed(2)} ${row.unit}`;
}

export function FacialAnalysisResults({ result }: { result: AnalysisResult }) {
  const byKey = (key: string) => result.parameters.find((row) => row.key === key);
  const groups = GROUPS.map((group) => ({
    ...group,
    rows: group.keys.map(byKey).filter((row): row is ParameterRow => Boolean(row)),
  })).filter((group) => group.rows.length > 0);

  const chartData = useMemo(
    () =>
      result.parameters.map((row) => {
        const midpoint = (row.range[0] + row.range[1]) / 2 || 1;
        return {
          name: row.name,
          example: Math.max(0, Math.min(180, (row.patient / midpoint) * 100)),
          reference: 100,
        };
      }),
    [result.parameters],
  );

  const flagged = result.parameters.filter((row) => row.status !== "normal");
  const interpretation =
    flagged.length === 0
      ? "The example values fall within their listed reference ranges. This is a demonstration of result presentation, not a measurement from the uploaded image."
      : `The example output highlights ${flagged.length} facial movement ${flagged.length === 1 ? "feature" : "features"} outside or near the listed reference ranges: ${flagged.map((row) => row.name.toLowerCase()).join(", ")}. These values are illustrative and were not measured from facial landmarks.`;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Facial Analysis Results</div>
          <h2 className="mt-1 font-display text-2xl font-semibold">Facial movement characteristics</h2>
        </div>
        <DemoBadge />
      </div>

      <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
        A real facial landmark pipeline is not currently configured. The values below are clearly labeled examples and are not measurements from the uploaded image.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-cyan" aria-hidden />
                <h3 className="text-sm font-semibold">{group.title}</h3>
              </div>
              <div className="mt-3 space-y-2">
                {group.rows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-4 rounded-lg bg-card/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground/90">{row.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Example reference {row.range[0]}–{row.range[1]} {row.unit}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-base font-semibold">{fmt(row)}</div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] capitalize ${STATUS_STYLE[row.status]}`}>
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Facial movement profile</h3>
          <DemoBadge />
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Example values normalized to the midpoint of each listed reference range. No movement-over-time signal is available from the current image input.
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 58 }}>
              <CartesianGrid stroke="hsl(215 20% 65% / 0.12)" vertical={false} />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fill: "hsl(215 20% 65%)", fontSize: 10 }} />
              <YAxis unit="%" tick={{ fill: "hsl(215 20% 65%)", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === "example" ? "Example" : "Reference"]}
              />
              <Bar dataKey="reference" name="Reference" fill="var(--color-muted-foreground)" opacity={0.25} radius={[4, 4, 0, 0]} />
              <Bar dataKey="example" name="Example" fill="var(--color-cyan)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">AI Interpretation</h3>
          <DemoBadge />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">{interpretation}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          This research demonstration does not diagnose Parkinson&apos;s disease or any other condition.
        </p>
      </div>
    </section>
  );
}