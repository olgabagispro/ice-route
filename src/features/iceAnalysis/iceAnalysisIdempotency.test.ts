import assert from "node:assert/strict";
import test from "node:test";

import { getIceAnalysisRunDecision } from "./iceAnalysisIdempotency.ts";

test("rejects duplicate in-flight ice analysis requests", () => {
  assert.equal(
    getIceAnalysisRunDecision({
      requestKey: "same",
      inFlightRequestKey: "same",
      completedRequestKey: null,
      hasCompletedResult: false,
    }),
    "reject_in_flight",
  );
});

test("reuses completed analysis for the same request key", () => {
  assert.equal(
    getIceAnalysisRunDecision({
      requestKey: "same",
      inFlightRequestKey: null,
      completedRequestKey: "same",
      hasCompletedResult: true,
    }),
    "reuse_completed",
  );
});

test("starts analysis when the request key changed", () => {
  assert.equal(
    getIceAnalysisRunDecision({
      requestKey: "next",
      inFlightRequestKey: null,
      completedRequestKey: "previous",
      hasCompletedResult: true,
    }),
    "start",
  );
});
