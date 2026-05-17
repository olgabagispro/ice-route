# Ice Analysis API

The ice-analysis API is a backend-only planning-estimate service for the Calculate Ice Class flow.

## Contract

Frontend request:

```json
{
  "navigationWindow": {
    "startDate": "2026-07-01",
    "endDate": "2026-07-14"
  },
  "legs": [
    {
      "legIndex": 0,
      "from": { "id": "a", "name": "Murmansk", "lat": 68.97, "lng": 33.08 },
      "to": { "id": "b", "name": "Dikson", "lat": 73.5, "lng": 80.55 },
      "northernmostPoint": { "lat": 74.1, "lng": 62.2 },
      "distanceNm": 920
    }
  ]
}
```

API response:

```json
{
  "legs": [
    {
      "from": "Murmansk",
      "to": "Dikson",
      "iceClass": "Arc7",
      "thickness": "1.2m",
      "risk": "HIGH",
      "integrity": 73,
      "distance": 920,
      "demandingSegment": "Northernmost exposure near 74.1N.",
      "advisories": [
        {
          "type": "ice",
          "title": "Worst-case ice age",
          "description": "Residual first-year ice with possible old-ice inclusions."
        },
        {
          "type": "warning",
          "title": "Planning estimate only",
          "description": "No live ice chart or authoritative operational ice dataset was attached."
        }
      ]
    }
  ]
}
```

The response intentionally matches the current React `AnalysisResult` shape used by the route cards, widget context, and PDF report path.

## Model And Data Boundary

- OpenAI model: `gpt-5.4`.
- Data inputs: itinerary legs, per-leg northernmost itinerary point, and navigation dates.
- v1 does not attach live satellite, national ice center, buoy, or operational ice-chart data.
- Output is planning guidance only, not an authoritative navigation order.

## SSM Setup

The Lambda reads the OpenAI key from SSM Parameter Store in `us-east-1`.

```bash
AWS_PROFILE=default \
AWS_REGION=us-east-1 \
OPENAI_API_KEY_PARAMETER=/ice-route/openai/api-key \
scripts/put-openai-key-to-ssm.sh .env
```

The script reads `OPENAI_API_KEY` from `.env` or `.env.local`, stores it as a SecureString, and does not print the key.

## Manual Deploy

Deployment is local/manual. The deploy helper uses AWS CLI against the default account and `us-east-1`.

```bash
AWS_PROFILE=default \
AWS_REGION=us-east-1 \
OPENAI_API_KEY_PARAMETER=/ice-route/openai/api-key \
OPENAI_MODEL=gpt-5.4 \
scripts/deploy-ice-analysis.sh
```

The script creates or updates:

- IAM role `ice-route-ice-analysis-role`
- Lambda `ice-route-ice-analysis`
- HTTP API Gateway `ice-route-ice-analysis`
- route `POST /ice-class-analysis`

It prints the final API URL. Set that URL as:

```bash
VITE_ICE_ANALYSIS_API_URL=https://example.execute-api.us-east-1.amazonaws.com/ice-class-analysis
```

Cloudflare Worker deployments may alternatively set `ICE_ANALYSIS_API_URL` and let `/api/ice-class-analysis` proxy to API Gateway.

## Smoke Test

After deployment:

```bash
curl -sS "$VITE_ICE_ANALYSIS_API_URL" \
  -H 'Content-Type: application/json' \
  -d '{
    "navigationWindow": {"startDate": "2026-07-01", "endDate": "2026-07-14"},
    "legs": [{
      "legIndex": 0,
      "from": {"name": "Murmansk", "lat": 68.97, "lng": 33.08},
      "to": {"name": "Dikson", "lat": 73.50, "lng": 80.55},
      "northernmostPoint": {"lat": 74.10, "lng": 62.20},
      "distanceNm": 920
    }]
  }'
```

Expected: HTTP 200 with a top-level `legs` array and one leg for each input leg.

