# Clinical Assessment and Research Workflows

This request is large, so it is split into four parts. Each part ships working screens and tests before the next one starts. Everything reuses the existing recording/upload component, quality gate, job runner, gait engine and results visuals. Nothing is built twice.

## Part A: Entry, roles, clinical patients and visits
- Mode selection screen at `/workspace` with two cards: Clinical Assessment and Research Analysis. A card is shown only if the user's role allows it (clinician/admin see Clinical, researcher/admin see Research). Existing nav keeps its look and gets one "Workspace" link.
- Patient list with search, filter and sort (owner/admin only). Shows empty, loading and error states.
- Patient profile: details, visit history, trial history, and optional sensitive fields (height, weight, medication state, clinical history, assessment scores), visible only to owner/admin.
- Create visit, which gets a unique visit ID (server-generated, e.g. `V-2026-000123`).
- The six required fields are validated once with the existing shared rules and then carried through the whole flow.

## Part B: Clinical assessment run, review and report
- Visit wizard with progress steps: protocol → consent (stored in the consents table, required before recording) → record or upload (existing component) → quality check → processing (existing job runner) → results with warnings → clinician review → report → set as baseline.
- TUG and 10MWT: protocol-specific instructions plus required timing inputs (start/stop marks, known distance). Without verified timing, the TUG/10MWT result shows "not verified" and no number.
- Results show units, quality indicators, video playback with pose overlay when landmarks are stored, and clinician notes with a review status (pending, reviewed, needs repeat).
- Corrections create a new review/annotation row plus an audit entry. Nothing is overwritten.
- Visit comparison: per-parameter differences, recording-condition differences, and quality/uncertainty side by side. No "improved" or "worsened" labels.
- Clinical PDF report with decision-support wording only. It contains no diagnosis and no treatment advice.
- A failed or cancelled run cannot produce a report: the button is disabled and the server refuses.

## Part C: Research projects
- New tables: research_projects, study_protocols, research_participants (coded IDs only, no names), datasets (source, version, checksum), ground_truth_annotations, data_splits (participant-level train/val/test), experiments (preprocessing/feature config, notes, status), evaluation_results.
- Research data is kept separate from clinical subjects. Clinical patients can only be linked when a recorded research-use consent exists.
- Screens: project list/create, protocol config, inclusion/exclusion criteria, participant registration, dataset import (CSV/JSON) with metadata validation, record/upload through the shared component, analysis-run history, annotations, splits, and evaluation.
- Evaluation metrics (MAE, bias, Bland-Altman limits, ICC where there are enough pairs) with bootstrap confidence intervals. When n is too small, they show "insufficient data" instead of a number.
- Exports in CSV, JSON and PDF. Each includes project ID, dataset source/version, participant and exclusion counts, protocols, missing-data summary, preprocessing, feature definitions and units, software versions, validation method, metrics, statistics settings and limitations. Exploratory results are labelled differently from validated ones.

## Part D: Voice/facial audit and acceptance tests
- Voice page: states that it accepts UCI precomputed acoustic features only (no raw audio yet), lists the features, preprocessing and limitations.
- Facial page: no biomarkers are shown, only an "In development" status. The existing demo panel is removed from results views.
- Tests: field validation is preserved, results land on the correct participant/session, permissions block other users (database-level checks via SQL with two test users), export contents, rerun history is kept, and failed runs block report generation. Browser walkthroughs cover the clinical path (patient → report) and the research path (project → export).

## Technical details
- Database: additive migrations only, with GRANTs plus RLS. New tables: `clinical_annotations`, `visit_baselines`, `research_*` tables as listed. New columns on `subjects`/`visits`: `weight_kg`, `medication_state`, `clinical_history`, `visit_code`, all nullable. The `has_role` helper is used for role gates.
- Server functions in `src/lib/clinical.functions.ts` and `src/lib/research.functions.ts` with `requireSupabaseAuth`. Report generation checks that the run status is completed or completed_with_warnings.
- Routes: `_authenticated/workspace.tsx`, `_authenticated/clinical/*`, `_authenticated/research-projects/*`.
- Role assignment: still open. One account needs to be made admin before role-gated screens can be fully tested.

## Not possible to verify here
- Real camera and a real walking patient.
- Clinical accuracy. Any metrics shown come only from the user's own annotated data.
