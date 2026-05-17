import {
  buildIceAnalysisRequest,
  type IceAnalysisRequest,
  type IceAnalysisRouteLeg,
  type IceAnalysisWaypoint,
} from "./iceAnalysisClient";

export function buildIceAnalysisRequestKey(
  waypoints: IceAnalysisWaypoint[],
  startDate: string,
  endDate: string,
  itineraryLegs: IceAnalysisRouteLeg[] = [],
) {
  return stableStringify(normalizeIceAnalysisRequestForKey(
    buildIceAnalysisRequest(waypoints, startDate, endDate, itineraryLegs),
  ));
}

export function normalizeIceAnalysisRequestForKey(request: IceAnalysisRequest) {
  return {
    navigationWindow: {
      startDate: request.navigationWindow.startDate,
      endDate: request.navigationWindow.endDate,
    },
    legs: request.legs.map((leg) => ({
      legIndex: leg.legIndex,
      from: normalizeWaypointForKey(leg.from),
      to: normalizeWaypointForKey(leg.to),
      northernmostPoint: normalizePointForKey(leg.northernmostPoint),
      distanceNm: normalizeNumberForKey(leg.distanceNm),
    })),
  };
}

function normalizeWaypointForKey(point: IceAnalysisWaypoint) {
  return {
    id: point.id || "",
    lat: normalizeNumberForKey(point.lat),
    lng: normalizeNumberForKey(point.lng),
    name: point.name || "",
  };
}

function normalizePointForKey(point: { lat: number; lng: number }) {
  return {
    lat: normalizeNumberForKey(point.lat),
    lng: normalizeNumberForKey(point.lng),
  };
}

function normalizeNumberForKey(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
      return sorted;
    }, {});
}
