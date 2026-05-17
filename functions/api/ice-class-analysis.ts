const allowedCorsOrigins = new Set([
  "https://ice-navigator.com",
  "https://www.ice-navigator.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function isAllowedCorsOrigin(origin: string) {
  if (allowedCorsOrigins.has(origin)) {
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

function responseHeadersFor(request: Request) {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };

  if (origin && isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export async function onRequest(context: { request: Request; env: { ICE_ANALYSIS_API_URL?: string } }) {
  const { request, env } = context;
  const responseHeaders = responseHeadersFor(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  if (!env.ICE_ANALYSIS_API_URL) {
    return new Response(JSON.stringify({ error: "ICE_ANALYSIS_API_URL is not configured" }), {
      status: 503,
      headers: responseHeaders,
    });
  }

  const upstreamResponse = await fetch(env.ICE_ANALYSIS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: await request.text(),
  });

  return new Response(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: {
      ...responseHeaders,
      "Content-Type": upstreamResponse.headers.get("Content-Type") || "application/json",
    },
  });
}
