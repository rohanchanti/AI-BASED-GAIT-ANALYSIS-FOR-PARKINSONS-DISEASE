import { AlertTriangle } from "lucide-react";
import { QualityBar, NotAvailable, ResearchCard } from "./primitives";
import { DEFAULT_POSE_CONFIG } from "@/services/pose/poseConfig";
import type { PoseAnalysis } from "@/types/gait";

/**
 * Data-quality panel. Every bar maps to a value actually measured by the pose
 * pipeline; factors the pipeline does not measure (lighting, face tracking)
 * render as "Not available" rather than an invented score.
 */
export function VideoQualityPanel({ pose }: { pose: PoseAnalysis | null }) {
  const q = pose?.quality ?? null;
  const video = pose?.video ?? null;
  const cfg = DEFAULT_POSE_CONFIG;

  const overall = q?.overall ?? null;
  const lowQuality = overall != null && overall < 65;

  const resolutionOk =
    video ? video.width >= cfg.minWidth && video.height >= cfg.minHeight : null;
  const fpsOk = video ? video.sampledFps >= cfg.minSampleFps : null;

  const warnings = [
    ...(q?.warnings ?? []),
    ...(pose?.validation?.warnings ?? []),
    ...(pose?.validation?.blocking ?? []),
    ...(pose?.metrics.warnings ?? []),
  ].filter((w, i, all) => all.indexOf(w) === i);

  return (
    <ResearchCard
      title="Data quality"
      subtitle="Computed from the analysed frames before any biomarker is reported."
      right={
        <div className="rounded-lg border border-border/70 px-3 py-1.5 text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Overall research quality
          </div>
          <div className="font-display text-lg font-semibold">
            {overall != null ? `${overall.toFixed(0)}%` : <NotAvailable reason="No pose analysis available." />}
          </div>
        </div>
      }
    >
      {!pose && (
        <p className="text-xs text-muted-foreground">
          Quality metrics are produced by the markerless pose pipeline. No pose analysis was
          recorded for this result, so no quality measurement is available.
        </p>
      )}

      {pose && (
        <>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <QualityBar
              label="Pose tracking confidence"
              value={q?.poseConfidence ?? null}
              note="Mean landmark visibility across analysed frames."
            />
            <QualityBar
              label="Body visibility"
              value={q?.bodyVisibilityScore ?? null}
              note="Frames with upper and lower limbs both visible."
            />
            <QualityBar
              label="Valid frames"
              value={q?.validFramePercent ?? null}
              note="Frames with all required gait landmarks trusted."
            />
            <QualityBar
              label="Tracking continuity"
              value={q?.continuityScore ?? null}
              note="Absence of dropouts / interpolated gaps."
            />
            <QualityBar
              label="Camera stability"
              value={q?.videoStabilityScore ?? null}
              note={
                q?.cameraJitter != null
                  ? `Residual torso jitter ${q.cameraJitter.toFixed(4)} normalized units.`
                  : "Jitter not measurable."
              }
            />
            <QualityBar
              label="Gait cycle sufficiency"
              value={q?.gaitCycleSufficiency ?? null}
              note={`${q?.validCycles ?? 0} complete cycle(s); ${cfg.minGaitCycles} needed for stable aggregation.`}
            />
            <QualityBar
              label="Lighting"
              value={null}
              note="Photometric assessment is not implemented in the current pipeline."
            />
            <QualityBar
              label="Face tracking confidence"
              value={null}
              note="Facial landmark pipeline not configured."
            />
            <div>
              <div className="text-xs text-muted-foreground">Acquisition checks</div>
              <ul className="mt-1.5 space-y-1 text-[11px]">
                <li className={resolutionOk === false ? "text-warning" : "text-muted-foreground"}>
                  Resolution{" "}
                  {video ? (
                    <span className="text-foreground/80">
                      {video.width}×{video.height}
                    </span>
                  ) : (
                    <NotAvailable />
                  )}
                  {resolutionOk === false ? ` — below ${cfg.minWidth}×${cfg.minHeight} minimum` : ""}
                </li>
                <li className={fpsOk === false ? "text-warning" : "text-muted-foreground"}>
                  Sampled frame rate{" "}
                  {video ? (
                    <span className="text-foreground/80">{video.sampledFps.toFixed(1)} fps</span>
                  ) : (
                    <NotAvailable />
                  )}
                  {fpsOk === false ? ` — below ${cfg.minSampleFps} fps minimum` : ""}
                </li>
                <li className="text-muted-foreground">
                  Frames without a subject{" "}
                  <span className="text-foreground/80">{pose.metrics.framesWithoutPerson}</span>
                </li>
                <li className="text-muted-foreground">
                  Frames with multiple people{" "}
                  <span className="text-foreground/80">{pose.metrics.framesWithMultiplePeople}</span>
                </li>
              </ul>
            </div>
          </div>

          {lowQuality && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Low-quality input detected. Some quantitative measurements may be unreliable.
              </p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Detected issues
              </div>
              <ul className="mt-2 space-y-1.5">
                {warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </ResearchCard>
  );
}
