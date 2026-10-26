export type Coordinate = [longitude: number, latitude: number];

export interface TileProviderAdapter {
  id: string;
  styleUrl: string;
  attribution: string;
}

export const openFreeMapTiles: TileProviderAdapter = {
  id: 'openfreemap',
  styleUrl: 'https://tiles.openfreemap.org/styles/positron',
  attribution: 'OpenFreeMap, OpenMapTiles, OpenStreetMap',
};

export interface PlaceCandidate {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PlaceSearchAdapter {
  search(query: string, locale: 'it' | 'en', signal?: AbortSignal): Promise<PlaceCandidate[]>;
}

export type RouteProfile = 'driving' | 'walking';

export interface RoadRoute {
  geometry: { type: 'LineString'; coordinates: Coordinate[] };
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
}

export interface DirectionsAdapter {
  route(coordinates: Coordinate[], profile: RouteProfile, signal?: AbortSignal): Promise<RoadRoute>;
}

export interface LineFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { kind: 'schematic'; label: string };
    geometry: { type: 'LineString'; coordinates: Coordinate[] };
  }>;
}

export function createSchematicRoute(coordinates: Coordinate[], label: string): LineFeatureCollection {
  if (coordinates.length < 2) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { kind: 'schematic', label },
      geometry: { type: 'LineString', coordinates },
    }],
  };
}

async function csrfToken(signal?: AbortSignal): Promise<string> {
  const options: RequestInit = { credentials: 'same-origin' };
  if (signal) options.signal = signal;
  const response = await fetch('/api/auth/csrf', options);
  if (!response.ok) throw new Error('map_service_unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('csrfToken' in body) || typeof body.csrfToken !== 'string') {
    throw new Error('map_service_unavailable');
  }
  return body.csrfToken;
}

async function postMapRequest<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const token = await csrfToken(signal);
  const options: RequestInit = {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(body),
  };
  if (signal) options.signal = signal;
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(response.status === 429 ? 'map_service_quota' : 'map_service_unavailable');
  return response.json() as Promise<T>;
}

export const locationIqSearchAdapter: PlaceSearchAdapter = {
  search(query, locale, signal) {
    return postMapRequest<{ results: PlaceCandidate[] }>('/api/maps/search', { query, locale }, signal)
      .then((result) => result.results);
  },
};

export const locationIqDirectionsAdapter: DirectionsAdapter = {
  route(coordinates, profile, signal) {
    return postMapRequest<RoadRoute>('/api/maps/route', { coordinates, profile }, signal);
  },
};