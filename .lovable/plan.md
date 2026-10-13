# Phase 1 — Audit + Data Foundation

## 1. Audit of the current app

**Works today (keep as is)**
- Sign-in (email + Google), protected Dashboard / Reports / Voice pages.
- Live camera recording and video upload, both feeding the same analysis.
- Required subject form (name, ID, age, sex, recording condition, notes).
- Real gait analysis: frame motion analysis plus MediaPipe pose (33 landmarks, joint angles, heel strike / toe off, cycles, quality checks).
- Dashboard charts, gait visuals, PDF/PNG/CSV/JSON exports with analysis ID and versions.
- Voice page: Random Forest trained in the browser on the UCI dataset (real metrics).

**Partly working**
- Facial analysis: only file intake is real; results are labelled demo data.
- Analysis ID comes from a counter in the browser, so two devices can create the same ID.
- History: only a summary (score, parameter rows) is saved. Landmarks, events, quality and the full subject form live only in the browser tab and are lost on close.
- Saving to history happens only when the dashboard opens with a result.

**Missing**
- Subjects, visits, consent, protocols, recording files, analysis runs, clinician reviews, audit log, export history.
- Roles (Admin / Clinician / Researcher).
- File storage for original recordings.

**Data-flow problems**
- Each report repeats patient name/age/sex instead of linking to one subject, so the same person can't be followed over visits.
- Repeating an analysis creates an unrelated row; nothing links runs together.
- Voice results are never saved.

**Security / privacy gaps**
- Every user sees only their own reports — fine — but there is no way to share with a team or to separate identifiable data from research data.
- Patient names are stored alongside results with no coded ID for research use.
- No consent record and no activity log.

## 2. Proposed schema (new, additive)

```text
user_roles (admin | clinician | researcher)  + has_role()
subjects ──< consents
   │  (owner, subject_code, display_name [identifiable], age, sex, height_cm, ...)
   └──< visits ──< recordings ──< analysis_runs ──< gait_results
          │           (file path,     (versions, config,   (metrics, quality,
          │            status, fps,    status, link to       events, landmarks
          │            camera angle)   legacy report)        summary)
          └── protocols (name, test type, settings)
analysis_runs ──< clinician_reviews
audit_log (who, what, which record, when)   export_log
```

- Research views expose `subject_code` only, never `display_name`.
- Runs are never overwritten: a repeat creates a new run linked to the same recording.
- Private storage bucket `recordings`, files under `<user_id>/...`.

**Access rules (enforced in the database)**
- Owner sees and edits their own subjects and everything under them.
- Clinician: own records, can write reviews.
- Researcher: read coded data only through a de-identified view.
- Admin: read all, manage roles.
- Audit log: insert-only, readable by admins.

## 3. Migration strategy

- Only new tables, plus one nullable column `reports.analysis_run_id`. Nothing renamed or removed; existing reports and pages keep working.
- No fake rows inserted.
- The first account to sign up after this is not auto-made admin; I'll ask which account should be admin.

## 4. Small first wiring (keeps the UI the same)
- When a gait report is saved, also create subject → visit → recording → run → result records from the already-entered form, and log it. If that fails, the old report still saves.
- Tests for the field validation rules.

## 5. Risks
- Storing full per-frame landmarks can be large; Phase 1 stores a summary and events only.
- Uploading original videos is prepared (bucket + rules) but not switched on yet, to avoid slowing the current flow.
- Not a claim of clinical validation or any regulatory compliance.

## Not in this phase
Clinical Mode and Research Mode screens, dataset import, ground-truth comparisons.
