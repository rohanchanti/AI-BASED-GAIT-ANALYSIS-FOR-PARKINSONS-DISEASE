import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  effects: [] as Array<() => unknown>,
  getSession: vi.fn(),
  analyzeVideoFile: vi.fn(),
  runPoseGaitAnalysis: vi.fn(),
  createAnalysisJob: vi.fn(),
  saveJobResults: vi.fn(),
  updateJobStatus: vi.fn(),
  generateMockAnalysis: vi.fn(),
  persistPoseAnalysis: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => unknown) => { calls.effects.push(effect); },
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: calls.getSession } } }));
vi.mock("@/lib/video-analyzer", () => ({ analyzeVideoFile: calls.analyzeVideoFile }));
vi.mock("@/services/pose/gaitAnalysisService", () => ({ runPoseGaitAnalysis: calls.runPoseGaitAnalysis }));
vi.mock("@/lib/pose-session", () => ({ persistPoseAnalysis: calls.persistPoseAnalysis, toStorable: vi.fn() }));
vi.mock("@/lib/mock-analysis", () => ({
  analysisFromEngine: vi.fn(), unavailableGaitAnalysis: vi.fn(), generateMockAnalysis: calls.generateMockAnalysis,
}));
vi.mock("@/lib/jobs.functions", () => ({
  createAnalysisJob: calls.createAnalysisJob, createUploadUrl: vi.fn(), verifyUpload: vi.fn(),
  discardFailedUpload: vi.fn(), updateJobStatus: calls.updateJobStatus, saveJobResults: calls.saveJobResults,
}));
vi.mock("@/lib/job-runner", () => ({
  uploadWithRetry: vi.fn(), assessRecording: vi.fn(), UploadCancelled: class extends Error {},
}));
vi.mock("@/lib/gait-engine/parameters", () => ({ computeGaitParameters: vi.fn(), EVENT_METHOD: "ankle" }));
vi.mock("@/lib/gait-engine/frames", () => ({ serializeFrames: vi.fn(), qualitySummary: vi.fn() }));

import { ProcessingScreen } from "./ProcessingScreen";

beforeEach(() => {
  vi.clearAllMocks();
  calls.effects.length = 0;
  calls.getSession.mockResolvedValue({ data: { session: null } });
  calls.analyzeVideoFile.mockRejectedValue(new Error("Stop after entering the real gait decoder"));
});

describe("processing availability", () => {
  it("never generates, processes, saves, or completes a facial result", async () => {
    const onComplete = vi.fn();
    ProcessingScreen({ kind: "facial", mode: "quick", file: new File(["image"], "face.png"), onComplete });
    for (const effect of calls.effects) effect();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.getSession).not.toHaveBeenCalled();
    expect(calls.analyzeVideoFile).not.toHaveBeenCalled();
    expect(calls.runPoseGaitAnalysis).not.toHaveBeenCalled();
    expect(calls.generateMockAnalysis).not.toHaveBeenCalled();
    expect(calls.createAnalysisJob).not.toHaveBeenCalled();
    expect(calls.saveJobResults).not.toHaveBeenCalled();
    expect(calls.updateJobStatus).not.toHaveBeenCalled();
    expect(calls.persistPoseAnalysis).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("still passes gait videos to the existing real decoder", async () => {
    const file = new File(["video"], "walk.mp4", { type: "video/mp4" });
    ProcessingScreen({ kind: "gait", mode: "normal", file, onComplete: vi.fn() });
    for (const effect of calls.effects) effect();
    await vi.waitFor(() => expect(calls.analyzeVideoFile).toHaveBeenCalledWith(file, expect.any(Function), expect.any(AbortSignal)));
    expect(calls.generateMockAnalysis).not.toHaveBeenCalled();
  });
});