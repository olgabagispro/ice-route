import assert from "node:assert/strict";
import test from "node:test";

import { buildIceAnalysisRequestKey } from "./iceAnalysisRequestKey.ts";

test("builds the same key for identical ice analysis inputs", () => {
  const waypoints = [
    { id: "magadan", lat: 59.5648506, lng: 150.7268124, name: "Magadan" },
    { id: "wrangel", lat: 71.2488724, lng: -179.9789208, name: "Wrangel Island" },
  ];

  assert.equal(
    buildIceAnalysisRequestKey(waypoints, "2026-06-01", "2026-08-31"),
    buildIceAnalysisRequestKey(waypoints, "2026-06-01", "2026-08-31"),
  );
});

test("changes the key when navigation dates change", () => {
  const waypoints = [
    { id: "a", lat: 68, lng: 30, name: "A" },
    { id: "b", lat: 70, lng: 40, name: "B" },
  ];

  assert.notEqual(
    buildIceAnalysisRequestKey(waypoints, "2026-06-01", "2026-08-31"),
    buildIceAnalysisRequestKey(waypoints, "2026-07-01", "2026-08-31"),
  );
});

test("changes the key when itinerary geometry changes the northernmost point", () => {
  const waypoints = [
    { id: "a", lat: 68, lng: 30, name: "A" },
    { id: "b", lat: 70, lng: 40, name: "B" },
  ];

  const firstKey = buildIceAnalysisRequestKey(waypoints, "2026-06-01", "2026-08-31", [
    {
      legIndex: 0,
      from: { lat: 68, lng: 30 },
      to: { lat: 70, lng: 40 },
      coordinates: [[35, 72]],
    },
  ]);
  const secondKey = buildIceAnalysisRequestKey(waypoints, "2026-06-01", "2026-08-31", [
    {
      legIndex: 0,
      from: { lat: 68, lng: 30 },
      to: { lat: 70, lng: 40 },
      coordinates: [[35, 74]],
    },
  ]);

  assert.notEqual(firstKey, secondKey);
});
