# Roadmap

- [ ] Dashboard only: database-backed user subjects, visits and analyses, empty states, saved-result restoration after refresh/sign-in; signed-in verification.

- [x] Pipeline only: ankle-event timing, stride variability and symmetry with saved units/methods; calibration-gated spatial measures; synthetic ankle-to-storage regression checks passed. Real-video processing and a fresh database insert were not exercised.

- [x] Pipeline only: preserve missing landmarks and reject failed visibility, confidence, duration and gait-cycle checks with needs_better_video and reasons; 67 automated checks passed. Real-video end-to-end processing not exercised in this task.

- [x] Complete and verify the existing dashboard presentation improvements.
- [x] Improve only the Reports section with a representative multimodal sample report, clear DEMO DATA labels, existing visualizations, interpretation, disclaimer, and existing view/export actions.
- [x] Verify the affected dashboard and reports experiences.

- [x] Final integration: clinical CSV/JSON exports, consent/review defects fixed, E2E clinical/research/isolation/regression checks
- [ ] Assign real clinician/researcher/admin roles (waiting on user)
- [x] Remove listed mock gait values and verify missing-value handling; 53 automated checks and signed-in report checks passed.
- [x] Connect the existing Subject Information form, optional Notes, age 18–110, inline validation and duplicate-ID rejection.
- [x] Add required versioned consent to the same form; verified disabled analysis without consent, saved consent text/version, optional Notes and duplicate-ID errors; 61 tests passed.
- [x] Add analysis metadata and normalized gait features with owner-only access and immutable reanalysis history; no UI changes. Verified 49 tests and rolled-back database persistence/history checks.
