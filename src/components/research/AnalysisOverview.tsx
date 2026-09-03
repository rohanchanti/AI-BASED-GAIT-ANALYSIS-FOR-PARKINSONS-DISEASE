import { MetricValue, NotAvailable, ResearchCard } from "./primitives";
import { ANALYSIS_VERSIONS, formatAnalysisDate } from "@/lib/analysis-version";
import type { PoseAnalysis } from "@/types/gait";

const VIEW_LABEL: Record<string, string> = {
  side: "Side (sagittal)",
  front: "Front (coronal)",
  rear: "Rear",
  unknown: "Undetermined",
};

export interface OverviewIdentity {
  analysisId?: string | null;
  subjectId?: string | null;
  sessionId?: string | null;
  analysisTimestamp?: string | null;
  mediaName?: string | null;
  mode?: string | null;
}

export function AnalysisOverview({
  identity,
  pose,
}: {
  identity: OverviewIdentity;
  pose: PoseAnalysis | null;
}) {
  const video = pose?.video ?? null;
  const overall = pose?.quality?.overall ?? null;
  const date =
    formatAnalysisDate(identity.analysisTimestamp ?? pose?.generatedAt ?? undefined) ?? null;

  return (
    <ResearchCard
      title="Analysis overview"
      subtitle="Identifiers, acquisition properties and pipeline versions recorded for reproducibility."
      right={
        <div className="rounded-lg border border-border/70 px-3 py-1.5 text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Overall data quality
          </div>
          <div className="font-display text-lg font-semibold">
            {overall != null ? `${overall.toFixed(0)}%` : <NotAvailable reason="No pose analysis recorded for this result." />}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <MetricValue label="Analysis ID" value={identity.analysisId ?? null} />
        <MetricValue
          label="Subject ID"
          value={identity.subjectId || null}
          description={identity.subjectId ? undefined : "Subject register not configured yet."}
        />
        <MetricValue
          label="Session ID"
          value={identity.sessionId || null}
          description={identity.sessionId ? undefined : "Session register not configured yet."}
        />
        <MetricValue label="Analysis date" value={date} />
        <MetricValue label="Protocol" value={identity.mode ?? null} />

        <MetricValue
          label="Video duration"
          value={video ? video.durationSec.toFixed(1) : null}
          unit="s"
        />
        <MetricValue
          label="Sampled frame rate"
          value={video ? video.sampledFps.toFixed(1) : null}
          unit="fps"
          description={video ? `${video.sampledFrames} frames analysed` : undefined}
        />
        <MetricValue
          label="Resolution"
          value={video ? `${video.width} × ${video.height}` : null}
          unit="px"
        />
        <MetricValue
          label="Camera view"
          value={pose ? (VIEW_LABEL[pose.metrics.cameraView] ?? pose.metrics.cameraView) : null}
          description={pose ? "Inferred from landmark geometry." : undefined}
        />
        <MetricValue label="Source file" value={identity.mediaName ?? null} />

        <MetricValue label="Platform version" value={ANALYSIS_VERSIONS.platform} />
        <MetricValue label="Gait model" value={ANALYSIS_VERSIONS.gaitModel} />
        <MetricValue label="Feature pipeline" value={ANALYSIS_VERSIONS.featurePipeline} />
        <MetricValue
          label="Pose estimator"
          value={pose ? ANALYSIS_VERSIONS.poseEstimator : null}
          description={pose ? undefined : "Pose estimation did not run for this result."}
        />
        <MetricValue
          label="Face estimator"
          value={ANALYSIS_VERSIONS.faceEstimator}
          description="Facial landmark pipeline not configured."
        />
      </div>
    </ResearchCard>
  );
}
