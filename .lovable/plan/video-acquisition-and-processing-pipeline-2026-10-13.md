# Video acquisition and processing pipeline

## Key constraint (please read)
The server here runs on an edge runtime. It cannot decode video or run pose estimation, and there is no long-running worker. The existing MediaPipe pose engine works and runs in the browser. The plan keeps that engine, moves it into a background browser worker so the page stays responsive, and keeps all job status, files and results on the server. A true server-side processing service would need an external GPU/container host. That can be added later behind the same job states.

## 1. Subject and session
- Keep the six required fields and current validation. Save a draft on each change so a refresh or accidental navigation keeps the entered data. Warn before leaving with unsaved data.
- On "Analyse", create the subject, visit (session), protocol choice and recording records in a single server call. The button locks after the first click and the call is idempotent, using a client-generated session key.

## 2. Protocols
- Protocol picker: Straight-line walk, TUG, Front view, Side view. Trial number from 1 to N (multiple trials per session).
- Each protocol shows instructions and stores camera angle, trial number, walking distance (optional) and deviations (free text).
- Frame rate and duration are taken from the actual file. Protocol checks are reported as "checked: pass/fail" only where they can be measured (minimum duration, view orientation from landmarks, visible full body). Anything else is marked "not verified".

## 3. Live camera (extend the existing component)
- Camera selection list (enumerateDevices after permission), Pause/Resume when MediaRecorder supports it, recording status label, playback, retake, and upload.
- Clear messages: HTTPS required, permission denied, no camera, unsupported browser. Release camera tracks on stop, on retake and when the page is left.
- A recording counts as successful only when the captured blob has a non-zero size and decodes with a duration of at least 1 second.

## 4. Upload
- Drag-and-drop plus file picker. MIME and extension allow-list (MP4/WebM/MOV). Configurable size limit in one config module (default 200 MB) and a local decode check before upload.
- Uploads go to the private `recordings` storage bucket using XHR to a signed upload URL, with progress, Cancel and Retry. Owner-only storage policies apply and no public URLs are created.
- Server verification: after upload, a server function reads the first bytes of the stored object to confirm the MP4/WebM/QuickTime signature and checks the size. It rejects files that fail and deletes them.

## 5. Job states and processing
- Add a status table/columns on analysis runs: queued, uploading, processing, completed, completed_with_warnings, failed, cancelled. Also store progress, stage, attempt count, heartbeat timestamp and error.
- Pipeline stages run in a Web Worker using the existing pose/gait services: verification, metadata, frame decoding, pose detection, landmark quality, gait events, features, QC, persistence. Each stage transition is saved to the server.
- Refresh: a "Jobs" panel reads server status. A job left "processing" with a stale heartbeat (more than 2 minutes) is shown as interrupted and offers Resume/Retry. Retry re-downloads the private file via a signed URL. Cancel is supported.
- Results are saved to gait results and linked to the legacy report. The results screen loads from the server by run ID.
- The processing UI keeps the previously requested silent style: one overall progress bar. Stage names are stored on the server but not shown.

## 6. Data quality gate
- Checks: duration, fps, unreadable frame ratio, multiple people (pose landmarker set to 2 poses; more than 1 detected in many frames is flagged), landmark visibility/confidence, obscured body segments, camera positioning (body size/centering/cut-off), lighting (mean luminance/contrast), usable-frame count.
- Below the minimum thresholds the job ends as "failed" with specific correction advice. Marginal results end as "completed with warnings".

## 7. Testing
- Unit tests: validation, upload limits/signature check, status transitions, quality thresholds.
- Playwright: simulated camera recording and playback, permission denial, upload with progress and cancel, corrupted file rejection, refresh during processing, results reload.
- A real physical camera and a real walking subject cannot be tested in the sandbox. These will be reported as untested.

## Technical details
- Migration: add status/progress/stage/attempts/heartbeat/session_key columns to `analysis_runs`; add trial_number/deviations/protocol fields to `recordings`; add storage.objects owner policies on `recordings/{uid}/...`.
- Server functions (`requireSupabaseAuth`): `createSession`, `createUploadUrl`, `verifyUpload`, `updateRunStatus`, `getRun`, `listRuns`, `getRecordingUrl`, `saveRunResults`.
- New: `src/lib/video-config.ts`, `src/lib/pipeline.worker.ts`, `src/lib/job-runner.ts`, `src/routes/_authenticated/jobs.tsx` (status and resume). Existing analyzer modules are reused and not rewritten.
