import assert from "node:assert/strict";
import test from "node:test";

import { corsHeadersFor, handleSeaRoute, isAllowedCorsOrigin } from "./index.js";

test("allows the production ice-navigator origins", () => {
  assert.equal(isAllowedCorsOrigin("https://ice-navigator.com"), true);
  assert.equal(isAllowedCorsOrigin("https://www.ice-navigator.com"), true);
});

test("allows local development and ice-route workers.dev origins", () => {
  assert.equal(isAllowedCorsOrigin("http://localhost:3000"), true);
  assert.equal(isAllowedCorsOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isAllowedCorsOrigin("https://ice-route.example.workers.dev"), true);
});

test("does not allow unrelated origins", () => {
  assert.equal(isAllowedCorsOrigin("https://example.com"), false);
  assert.equal(isAllowedCorsOrigin("https://not-ice-route.example.workers.dev"), false);
  assert.equal(isAllowedCorsOrigin("not-a-url"), false);
});

test("echoes an allowed Origin header in CORS responses", () => {
  const request = new Request("https://ice-route.example.workers.dev/api/sea-route", {
    headers: { Origin: "https://ice-navigator.com" },
  });

  const headers = corsHeadersFor(request);

  assert.equal(headers["Access-Control-Allow-Origin"], "https://ice-navigator.com");
  assert.equal(headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(headers["Access-Control-Allow-Headers"], "Content-Type");
  assert.equal(headers.Vary, "Origin");
});

test("omits Access-Control-Allow-Origin for disallowed origins", () => {
  const request = new Request("https://ice-route.example.workers.dev/api/sea-route", {
    headers: { Origin: "https://example.com" },
  });

  assert.equal(corsHeadersFor(request)["Access-Control-Allow-Origin"], undefined);
});

test("handles allowed CORS preflight requests", async () => {
  const response = await handleSeaRoute(
    new Request("https://ice-route.example.workers.dev/api/sea-route", {
      method: "OPTIONS",
      headers: { Origin: "https://ice-navigator.com" },
    }),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://ice-navigator.com");
});
