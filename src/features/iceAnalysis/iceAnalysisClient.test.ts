import assert from "node:assert/strict";
import test from "node:test";

import { buildIceAnalysisRequest, findNorthernmostPoint } from "./iceAnalysisClient.ts";

test("uses the northernmost itinerary coordinate for each leg", () => {
  const waypoints = [
    { id: "a", lat: 68, lng: 30, name: "A" },
    { id: "b", lat: 70, lng: 40, name: "B" },
  ];
  const itineraryLegs = [
    {
      legIndex: 0,
      from: { lat: 68, lng: 30 },
      to: { lat: 70, lng: 40 },
      coordinates: [
        [30, 68],
        [35, 74.25],
        [40, 70],
      ] as [number, number][],
    },
  ];

  assert.deepEqual(findNorthernmostPoint(waypoints[0], waypoints[1], itineraryLegs[0]), {
    lat: 74.25,
    lng: 35,
  });
});

test("falls back to the northern endpoint when itinerary coordinates are stale", () => {
  const from = { id: "a", lat: 72, lng: 30, name: "A" };
  const to = { id: "b", lat: 70, lng: 40, name: "B" };
  const staleLeg = {
    legIndex: 0,
    from: { lat: 10, lng: 20 },
    to: { lat: 70, lng: 40 },
    coordinates: [[35, 80]] as [number, number][],
  };

  assert.deepEqual(findNorthernmostPoint(from, to, staleLeg), {
    lat: 72,
    lng: 30,
  });
});

test("builds backend request with current web route inputs", () => {
  const request = buildIceAnalysisRequest(
    [
      { id: "a", lat: 68, lng: 30, name: "A" },
      { id: "b", lat: 70, lng: 40, name: "B" },
    ],
    "2026-07-01",
    "2026-07-14",
  );

  assert.equal(request.navigationWindow.startDate, "2026-07-01");
  assert.equal(request.navigationWindow.endDate, "2026-07-14");
  assert.equal(request.legs.length, 1);
  assert.equal(request.legs[0].legIndex, 0);
  assert.deepEqual(request.legs[0].northernmostPoint, { lat: 70, lng: 40 });
  assert.equal(typeof request.legs[0].distanceNm, "number");
});

