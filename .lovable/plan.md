# Improve the Existing Dashboard

## Scope
- Modify only the existing dashboard page.
- Reuse the current saved-report query, latest session result, chart library, cards, navigation, and visual style.
- Do not change authentication, database tables, backend services, or analysis models.

## Changes
1. Replace the sparse report history area with **Recent Analyses**, showing analysis ID, date, modality, and status from saved reports.
2. Add **Latest Results** summaries for gait, facial, and voice. Use the current session and saved reports where available; show an explicit unavailable state rather than fabricated results.
3. Add compact **Key Metrics** cards derived from the current result or saved report metadata.
4. Add a small historical trend chart based on saved analysis scores. If no history exists, show a clearly marked **DEMO DATA** chart.
5. Add an **Analysis Summary** describing the current result or recent activity in research-oriented, non-diagnostic language.
6. Keep the existing detailed result sections unchanged below these dashboard overview additions.

## Verification
- Confirm the dashboard builds cleanly and renders both with and without a current analysis.
- Confirm every example-only value carries a visible **Demo Data** label.
