const SEA_ROUTE_UPSTREAM_URL = "https://usvmz35vpfuf3qaympixjlbfbe0dqian.lambda-url.eu-north-1.on.aws/route";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function handleSeaRoute(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
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
    headers: {
      ...corsHeaders,
      "Content-Type": upstreamResponse.headers.get("Content-Type") || "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/sea-route") {
      return handleSeaRoute(request);
    }

    return env.ASSETS.fetch(request);
  },
};
