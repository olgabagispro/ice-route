import assert from "node:assert/strict";
import test from "node:test";

import { buildMapFitPoints, getMapFitPointSignature } from "./mapFitPoints.ts";

test("adds the middle itinerary coordinate as a synthetic map-fit point", () => {
  const waypoints = [
    { lat: 10, lng: 20 },
    { lat: 30, lng: 40 },
  ];
  const itineraryLegs = [
    {
      legIndex: 0,
      from: waypoints[0],
      to: waypoints[1],
      coordinates: [
        [20, 10],
        [50, 60],
        [40, 30],
      ] as [number, number][],
    },
  ];

  assert.deepEqual(buildMapFitPoints(waypoints, itineraryLegs), [
    ...waypoints,
    { lat: 60, lng: 50 },
  ]);
});

test("does not add a synthetic point when itinerary coordinates only contain endpoints", () => {
  const waypoints = [
    { lat: 10, lng: 20 },
    { lat: 30, lng: 40 },
  ];
  const itineraryLegs = [
    {
      legIndex: 0,
      from: waypoints[0],
      to: waypoints[1],
      coordinates: [
        [20, 10],
        [40, 30],
      ] as [number, number][],
    },
  ];

  assert.deepEqual(buildMapFitPoints(waypoints, itineraryLegs), waypoints);
});

test("skips itinerary midpoint points that no longer match the current waypoint pair", () => {
  const waypoints = [
    { lat: 10, lng: 20 },
    { lat: 30, lng: 40 },
  ];
  const itineraryLegs = [
    {
      legIndex: 0,
      from: { lat: 80, lng: 90 },
      to: { lat: 30, lng: 40 },
      coordinates: [
        [20, 10],
        [50, 60],
        [40, 30],
      ] as [number, number][],
    },
  ];

  assert.deepEqual(buildMapFitPoints(waypoints, itineraryLegs), waypoints);
});

test("formats fit point signatures using the same precision as route signatures", () => {
  assert.equal(
    getMapFitPointSignature([
      { lat: 10.123456, lng: 20.987654 },
      { lat: 30.111111, lng: 40.222222 },
    ]),
    "10.12346,20.98765|30.11111,40.22222"
  );
});
