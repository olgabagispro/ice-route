const SEA_ROUTE_UPSTREAM_URL = "https://usvmz35vpfuf3qaympixjlbfbe0dqian.lambda-url.eu-north-1.on.aws/route";

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

export async function onRequest(context: { request: Request }) {
  const { request } = context;
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

  const upstreamResponse = await fetch(SEA_ROUTE_UPSTREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: await request.text(),
  });

  return new Response(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
