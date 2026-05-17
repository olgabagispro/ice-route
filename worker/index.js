const SEA_ROUTE_UPSTREAM_URL = "https://usvmz35vpfuf3qaympixjlbfbe0dqian.lambda-url.eu-north-1.on.aws/route";
const ICE_ANALYSIS_PATH = "/api/ice-class-analysis";

export const ALLOWED_CORS_ORIGINS = new Set([
  "https://ice-navigator.com",
  "https://www.ice-navigator.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function isAllowedCorsOrigin(origin) {
  if (ALLOWED_CORS_ORIGINS.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);

    return (
      url.protocol === "https:" &&
      url.hostname.startsWith("ice-route.") &&
      url.hostname.endsWith(".workers.dev")
    );
  } catch {
    return false;
  }
}

export function corsHeadersFor(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };

  if (origin && isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(request),
      "Content-Type": "application/json",
    },
  });
}

async function proxyPost(request, upstreamUrl) {
  const upstreamResponse = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: await request.text(),
  });

  return new Response(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: {
      ...corsHeadersFor(request),
      "Content-Type": upstreamResponse.headers.get("Content-Type") || "application/json",
    },
  });
}

export async function handleSeaRoute(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeadersFor(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  return proxyPost(request, SEA_ROUTE_UPSTREAM_URL);
}

export async function handleIceAnalysis(request, env = {}) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeadersFor(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  if (!env.ICE_ANALYSIS_API_URL) {
    return jsonResponse(request, { error: "ICE_ANALYSIS_API_URL is not configured" }, 503);
  }

  return proxyPost(request, env.ICE_ANALYSIS_API_URL);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/sea-route") {
      return handleSeaRoute(request);
    }

    if (url.pathname === ICE_ANALYSIS_PATH) {
      return handleIceAnalysis(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
