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
- Researchers read data only via the coded `research_coded_results()` function, never the subjects table. Why: keeps identifiable names out of research access.
- Gait video jobs: files go to the private `recordings` bucket via signed upload URLs, status lives on `analysis_runs` (queued→uploading→processing→completed/completed_with_warnings/failed/cancelled) and pose/gait compute runs in the browser. Why: the edge server cannot decode video or run MediaPipe; server keeps the durable state.
- Upload limits, allowed formats, protocols and quality-gate thresholds live only in `src/lib/video-config.ts`. Why: one place to tune rules, shared by UI, server and tests.
- Gait parameters come only from `src/lib/gait-engine/` (registry + compute returning value-or-unavailable with reason); per-frame landmarks and engine output are persisted on `gait_results`. Why: every displayed number must trace to a documented formula and stored inputs.
- Legacy gait adapters preserve missing measurements and scores as null through storage and exports; they never replace them with proxy or demo readings. Why: unavailable data must not look like a measured patient result.
- Clinical reports are stored as append-only JSON snapshots tagged `schema: neurostride.clinical-report/1` and exported (PDF/CSV/JSON) only from that stored snapshot. Why: every export traces to one run/visit and cannot drift from what was reviewed.
