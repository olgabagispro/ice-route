<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ea969a11-db91-40c9-be38-45d8e699c0f8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_ICE_ANALYSIS_API_URL` in `.env.local` to the ice-analysis API URL. OpenAI keys belong in AWS SSM, not in the browser bundle.
3. Run the app:
   `npm run dev`

## Ice Analysis Backend

The Calculate Ice Class flow calls a backend planning-estimate API that returns the current web `AnalysisResult` contract. See [docs/ice-analysis-api.md](docs/ice-analysis-api.md) for SSM setup, manual AWS deploy, and smoke-test commands.
