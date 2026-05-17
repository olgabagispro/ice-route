# API CORS Policy

The sea-route proxy endpoint at `/api/sea-route` only returns `Access-Control-Allow-Origin` for approved browser origins.

Approved origins:

- `https://ice-navigator.com`
- `https://www.ice-navigator.com`
- `https://ice-route.*.workers.dev`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

The Worker and Pages Functions entrypoints should stay in sync because the repository contains both deployment shapes:

- `worker/index.js`
- `functions/api/sea-route.ts`
