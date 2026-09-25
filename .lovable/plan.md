# Improve the Voice Analysis Module

## Scope
- Modify only the existing Voice Analysis page.
- Reuse the current 22 acoustic biomarker inputs, sample data, Random Forest model, charts, and visual style.
- Do not add audio capture, audio extraction, backend work, dependencies, or a new model because the current system accepts precomputed acoustic measurements rather than audio files.

## Changes
1. Reframe the page as a clear research workflow: provide acoustic measurements (or load a labeled example), then select **Analyze Voice**, then review results.
2. Clearly label the built-in healthy and Parkinson's dataset samples as **DEMO / EXAMPLE DATA**; user-entered biomarker values remain labeled as supplied measurements.
3. Present only available voice measurements, including fundamental-frequency values, jitter-based pitch variation, shimmer-based amplitude variation, and existing nonlinear/temporal features. Do not show speech duration or absolute voice intensity because the system does not calculate them.
4. Reuse the existing chart library to add a compact voice-feature profile visualization from the supplied or example biomarker values; do not present it as a recorded waveform.
5. Replace diagnostic language with research-oriented sections for **Observed Voice Characteristics** and **AI Interpretation**, using the existing model output and explicitly stating that it is not a diagnosis.
6. Keep the existing model-performance and dataset information, while clarifying the result as an uncalibrated research classification score.
7. Verify the page type-checks and renders without errors.
