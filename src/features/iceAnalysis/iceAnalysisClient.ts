export interface IceAnalysisWaypoint {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
}

export interface IceAnalysisRouteLeg {
  legIndex: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  coordinates: [number, number][];
  lengthKm?: number;
  durationHours?: number;
}

export interface LegAnalysis {
  from: string;
  to: string;
  fromPoint?: IceAnalysisWaypoint;
  toPoint?: IceAnalysisWaypoint;
  iceClass: string;
  thickness: string;
  risk: "LOW" | "MODERATE" | "HIGH";
  integrity: number;
  distance: number;
  demandingSegment: string;
  advisories: { type: "ice" | "seasonal" | "warning"; title: string; description: string }[];
}

export interface AnalysisResult {
  legs: LegAnalysis[];
}

export interface IceAnalysisRequest {
  navigationWindow: {
    startDate: string;
    endDate: string;
  };
  legs: Array<{
    legIndex: number;
    from: IceAnalysisWaypoint;
    to: IceAnalysisWaypoint;
    northernmostPoint: { lat: number; lng: number };
    distanceNm: number;
  }>;
}

const DEFAULT_ICE_ANALYSIS_API_URL = "/api/ice-class-analysis";

function getIceAnalysisApiUrl() {
  return (import.meta as any).env?.VITE_ICE_ANALYSIS_API_URL || DEFAULT_ICE_ANALYSIS_API_URL;
}

export async function requestIceClassAnalysis(
  waypoints: IceAnalysisWaypoint[],
  startDate: string,
  endDate: string,
  itineraryLegs: IceAnalysisRouteLeg[] = [],
): Promise<AnalysisResult> {
  const response = await fetch(getIceAnalysisApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildIceAnalysisRequest(waypoints, startDate, endDate, itineraryLegs)),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Ice analysis service failed with ${response.status}`);
  }

  return normalizeAnalysisResult(data, waypoints);
}

export function buildIceAnalysisRequest(
  waypoints: IceAnalysisWaypoint[],
  startDate: string,
  endDate: string,
  itineraryLegs: IceAnalysisRouteLeg[] = [],
): IceAnalysisRequest {
  return {
    navigationWindow: {
      startDate,
      endDate,
    },
    legs: waypoints.slice(0, -1).map((fromPoint, index) => {
      const toPoint = waypoints[index + 1];
      return {
        legIndex: index,
        from: sanitizeWaypoint(fromPoint),
        to: sanitizeWaypoint(toPoint),
        northernmostPoint: findNorthernmostPoint(fromPoint, toPoint, itineraryLegs[index]),
        distanceNm: calculateRouteDistance([fromPoint, toPoint]),
      };
    }),
  };
}

export function findNorthernmostPoint(
  fromPoint: IceAnalysisWaypoint,
  toPoint: IceAnalysisWaypoint,
  itineraryLeg?: IceAnalysisRouteLeg,
) {
  const candidates = [
    { lat: fromPoint.lat, lng: fromPoint.lng },
    { lat: toPoint.lat, lng: toPoint.lng },
  ];

  if (itineraryLeg && legMatchesEndpoints(itineraryLeg, fromPoint, toPoint)) {
    itineraryLeg.coordinates.forEach(([lng, lat]) => {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        candidates.push({ lat, lng });
      }
    });
  }

  return candidates.reduce((northernmost, candidate) => (
    candidate.lat > northernmost.lat ? candidate : northernmost
  ));
}

function normalizeAnalysisResult(data: any, waypoints: IceAnalysisWaypoint[]): AnalysisResult {
  const rawLegs = Array.isArray(data?.legs) ? data.legs : [];

  return {
    legs: waypoints.slice(0, -1).map((fromPoint, index) => {
      const toPoint = waypoints[index + 1];
      const rawLeg = rawLegs[index] || {};

      return {
        from: stringOrDefault(rawLeg.from, shortName(fromPoint.name) || `Waypoint ${index + 1}`),
        to: stringOrDefault(rawLeg.to, shortName(toPoint.name) || `Waypoint ${index + 2}`),
        fromPoint,
        toPoint,
        iceClass: stringOrDefault(rawLeg.iceClass, "Unknown"),
        thickness: stringOrDefault(rawLeg.thickness, "Unknown"),
        risk: normalizeRisk(rawLeg.risk),
        integrity: normalizeIntegrity(rawLeg.integrity),
        distance: normalizeDistance(rawLeg.distance, [fromPoint, toPoint]),
        demandingSegment: stringOrDefault(rawLeg.demandingSegment, `Section ${index + 1}: ${fromPoint.name || "Waypoint"} to ${toPoint.name || "Waypoint"}`),
        advisories: normalizeAdvisories(rawLeg.advisories),
      };
    }),
  };
}

function sanitizeWaypoint(point: IceAnalysisWaypoint): IceAnalysisWaypoint {
  return {
    id: point.id,
    lat: point.lat,
    lng: point.lng,
    name: point.name,
  };
}

function legMatchesEndpoints(
  itineraryLeg: IceAnalysisRouteLeg,
  fromPoint: IceAnalysisWaypoint,
  toPoint: IceAnalysisWaypoint,
) {
  return (
    coordinatesMatch(itineraryLeg.from, fromPoint) &&
    coordinatesMatch(itineraryLeg.to, toPoint)
  );
}

function coordinatesMatch(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) {
  return first.lat === second.lat && first.lng === second.lng;
}

function calculateRouteDistance(points: IceAnalysisWaypoint[]) {
  let total = 0;
  const radiusNm = 3440.065;

  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const dLat = (second.lat - first.lat) * Math.PI / 180;
    const dLng = (second.lng - first.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(first.lat * Math.PI / 180) * Math.cos(second.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += radiusNm * c;
  }

  return Math.round(total);
}

function normalizeRisk(value: unknown): "LOW" | "MODERATE" | "HIGH" {
  return value === "LOW" || value === "MODERATE" || value === "HIGH" ? value : "MODERATE";
}

function normalizeIntegrity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 50;
}

function normalizeDistance(value: unknown, points: IceAnalysisWaypoint[]) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : calculateRouteDistance(points);
}

function normalizeAdvisories(value: unknown): LegAnalysis["advisories"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const advisory = item as { type?: unknown; title?: unknown; description?: unknown };
    if (typeof advisory.description !== "string" || !advisory.description.trim()) {
      return [];
    }

    return [{
      type: advisory.type === "ice" || advisory.type === "seasonal" || advisory.type === "warning" ? advisory.type : "warning",
      title: typeof advisory.title === "string" && advisory.title.trim() ? advisory.title.trim() : "Ice advisory",
      description: advisory.description.trim(),
    }];
  });
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function shortName(value?: string) {
  return value?.split(",")[0]?.trim() || "";
}

