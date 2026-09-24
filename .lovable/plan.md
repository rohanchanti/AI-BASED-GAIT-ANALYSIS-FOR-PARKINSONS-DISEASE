# Improve the Facial Analysis Module

## Scope
- Keep the existing upload, patient details, mode selection, processing, authentication, storage, and dashboard flow unchanged.
- Limit presentation changes to facial-analysis inputs and facial-result displays.

## Changes
1. Update the existing upload area so its facial input accurately accepts the currently supported image formats and clearly labels facial analysis as a demo until a real facial landmark pipeline exists.
2. Reuse the existing analysis action and flow; make the facial path's action wording clear without creating another analyzer.
3. Add a focused facial-results component that renders only for facial sessions:
   - Clearly labeled `Demo / example data` status.
   - Existing facial parameter values, reference ranges, and statuses.
   - Grouped movement characteristics covering symmetry, blink-related measures, amplitude-related measures, and temporal characteristics only when matching fields exist.
   - A simple demo visualization based solely on the existing facial result parameters, not fabricated time-series samples.
   - A non-diagnostic AI interpretation derived from the existing parameter statuses and interpretations.
4. Hide gait-only result panels and pose visualizations during facial sessions, while preserving all current gait behavior.
5. Verify both facial and gait conditional rendering and run the existing TypeScript check.

## Technical details
- Add one small facial presentation component using the existing Recharts dependency and design tokens.
- Do not change `generateMockAnalysis`, the gait analyzer, pose estimation, report storage, or backend.
- Facial results will be explicitly labeled as demo because current facial values are deterministic examples generated from the filename, not real facial landmark measurements.
