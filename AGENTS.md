<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Subject/visit/recording/run data lives in linked tables (subjects→visits→recordings→analysis_runs→gait_results); legacy `reports` rows link via analysis_run_id. Why: one subject can be followed over visits and reruns never overwrite history.
- Acquisition Subject Information is validated by a shared browser/server schema and inserted before processing; jobs verify its owner-scoped subject ID rather than upserting it. Existing linked visits reuse their participant; duplicate new IDs are rejected by the owner/code unique constraint. Why: form submission must not overwrite an existing participant.
- Acquisition consent text and version share one definition, saved as a media_storage consent before analysis; acquisition jobs verify the owner, participant, version, grant and withdrawal state. Why: checkbox-only consent cannot authorize processing without a stored record.
- Researchers read data only via the coded `research_coded_results()` function, never the subjects table. Why: keeps identifiable names out of research access.
- Gait video jobs: files go to the private `recordings` bucket via signed upload URLs, status lives on `analysis_runs` (queued→uploading→processing→completed/completed_with_warnings/failed/cancelled) and pose/gait compute runs in the browser. Why: the edge server cannot decode video or run MediaPipe; server keeps the durable state.
- Upload limits, allowed formats, protocols and quality-gate thresholds live only in `src/lib/video-config.ts`. Why: one place to tune rules, shared by UI, server and tests.
- Quality gating normalizes percentage scores to ratios, checks protocol duration and complete cycles, and persists blocking reasons as needs_better_video before saving results. Missing landmark exports retain canonical positions with null slots. Why: incomplete or low-quality evidence cannot masquerade as measured gait data.
- Gait parameters come only from `src/lib/gait-engine/` (registry + compute returning value-or-unavailable with reason); per-frame landmarks and engine output are persisted on `gait_results`. Why: every displayed number must trace to a documented formula and stored inputs.
- Gait initial contacts use ankle-minus-pelvis kinematics without bridging rejected frame gaps; timing outputs carry formulas and units, with explicit temporal symmetry distinct from asymmetry. Spatial speed requires known-distance calibration evidence retained in the run's engine snapshot. Why: ankle-event provenance and calibration must be auditable without proxy distances.
- Analysis snapshots and normalized gait_features are written together by a gait_results insert trigger; terminal runs and stored results/features are immutable, and retry creates a fresh run ID. Why: provenance and reanalysis history must never overwrite prior outcomes.
- Legacy gait adapters preserve missing measurements and scores as null through storage and exports; they never replace them with proxy or demo readings. Why: unavailable data must not look like a measured patient result.
- Clinical reports are stored as append-only JSON snapshots tagged `schema: neurostride.clinical-report/1` and exported (PDF/CSV/JSON) only from that stored snapshot. Why: every export traces to one run/visit and cannot drift from what was reviewed.
- Dashboard reads owner-scoped database records through a user-keyed query primed by its authenticated loader; saved run snapshots and legacy reports restore results without browser session data, and traceable parameters receive the selected engine explicitly. Why: refresh, account changes and re-login cannot lose or mix dashboard results.
- Recordings carry subject_id kept equal to their visit's subject by a trigger; failed or cancelled uploads are discarded (run, recording row, stored object) rather than kept as rejected. Why: every stored recording traces to one subject and visit, and failed uploads leave no orphan records.
