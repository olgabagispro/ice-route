export interface MapFitPoint {
  lat: number;
  lng: number;
}

export interface ItineraryLeg {
  legIndex: number;
  from: MapFitPoint;
  to: MapFitPoint;
  coordinates: [number, number][];
}

export function buildMapFitPoints(waypoints: MapFitPoint[], itineraryLegs: ItineraryLeg[]): MapFitPoint[] {
  const fitPoints = [...waypoints];

  itineraryLegs.forEach((leg) => {
    if (!isCurrentItineraryLeg(leg, waypoints)) {
      return;
    }

    const midpoint = getItineraryMidpoint(leg.coordinates);

    if (midpoint) {
      fitPoints.push(midpoint);
    }
  });

  return fitPoints;
}

export function getMapFitPointSignature(points: MapFitPoint[]) {
  return points
    .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
    .join("|");
}

function isCurrentItineraryLeg(leg: ItineraryLeg, waypoints: MapFitPoint[]) {
  const from = waypoints[leg.legIndex];
  const to = waypoints[leg.legIndex + 1];

  return Boolean(
    from &&
    to &&
    from.lat === leg.from.lat &&
    from.lng === leg.from.lng &&
    to.lat === leg.to.lat &&
    to.lng === leg.to.lng
  );
}

function getItineraryMidpoint(coordinates: [number, number][]): MapFitPoint | null {
  if (coordinates.length < 3) {
    return null;
  }

  const [lng, lat] = coordinates[Math.floor(coordinates.length / 2)];

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}
