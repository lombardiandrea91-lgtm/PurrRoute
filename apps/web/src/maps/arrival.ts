import type { TripStop } from '@purrroute/domain';

export interface NearbyTripStop {
  stop: TripStop;
  distanceMeters: number;
}

export function distanceBetweenCoordinates(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const radians = Math.PI / 180;
  const latitudeDelta = (latitudeB - latitudeA) * radians;
  const longitudeDelta = (longitudeB - longitudeA) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA * radians) * Math.cos(latitudeB * radians)
      * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function findNearestUnvisitedStop(
  stops: TripStop[],
  latitude: number,
  longitude: number,
  radiusMeters: number,
  excludedStopIds: ReadonlySet<string> = new Set(),
): NearbyTripStop | null {
  let nearest: NearbyTripStop | null = null;
  for (const stop of stops) {
    if (stop.visitedAt !== null || stop.latitude === null || stop.longitude === null
      || excludedStopIds.has(stop.id)) continue;
    const distanceMeters = distanceBetweenCoordinates(latitude, longitude, stop.latitude, stop.longitude);
    if (distanceMeters <= radiusMeters && (!nearest || distanceMeters < nearest.distanceMeters)) {
      nearest = { stop, distanceMeters };
    }
  }
  return nearest;
}