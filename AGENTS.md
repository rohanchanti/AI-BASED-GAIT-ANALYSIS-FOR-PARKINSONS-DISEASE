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
