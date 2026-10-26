import type { PlaceCandidate, RouteRequest, RouteResponseSchema } from '@purrroute/contracts';
import type { Static } from 'typebox';

type Coordinate = RouteRequest['coordinates'][number];
type RouteProfile = RouteRequest['profile'];
type RoadRoute = Static<typeof RouteResponseSchema>;

const cacheTtlMs = 48 * 60 * 60 * 1000;
const requestsPerDayLimit = 4500;
const requestsPerMinuteLimit = 60;
const minimumRequestIntervalMs = 500;
const maximumCacheEntries = 500;
const providerBaseUrl = 'https://eu1.locationiq.com/v1';

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type MapProviderErrorCode = 'disabled' | 'invalid_request' | 'rate_limited' | 'daily_quota' | 'timeout' | 'unavailable' | 'no_route';

export class MapProviderError extends Error {
  readonly code: MapProviderErrorCode;

  constructor(code: MapProviderErrorCode) {
    super(code);
    this.code = code;
  }
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface LocationIqPlace {
  place_id?: string | number;
  display_name?: string;
  lat?: string | number;
  lon?: string | number;
}

interface LocationIqDirectionsResponse {
  code?: string;
  routes?: Array<{
    geometry?: { type?: string; coordinates?: unknown };
    distance?: number;
    duration?: number;
  }> | {
    geometry?: { type?: string; coordinates?: unknown };
    distance?: number;
    duration?: number;
  };
}

export interface LocationIqAdapterOptions {
  apiKey: string;
  fetcher?: FetchFunction;
  now?: () => number;
  timeoutMs?: number;
}

export class LocationIqAdapter {
  private readonly apiKey: string;
  private readonly fetcher: FetchFunction;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly requestTimes: number[] = [];
  private currentUtcDay = -1;
  private dailyRequestCount = 0;
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(options: LocationIqAdapterOptions) {
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  async searchPlaces(queryInput: string, locale: 'it' | 'en'): Promise<PlaceCandidate[]> {
    const query = queryInput.trim().replace(/\s+/g, ' ');
    if (query.length < 2 || query.length > 200) throw new MapProviderError('invalid_request');
    const cacheKey = `search:${locale}:${query.toLocaleLowerCase(locale)}`;
    const cached = this.getCache<PlaceCandidate[]>(cacheKey);
    if (cached) return cached;

    const url = new URL(`${providerBaseUrl}/search`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', locale);
    const response = await this.request(url);
    if (!response.ok) throw this.httpError(response.status);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new MapProviderError('unavailable');

    const places = body.flatMap((item: LocationIqPlace) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
        || typeof item.display_name !== 'string') return [];
      const label = item.display_name.split(',')[0]?.trim();
      if (!label) return [];
      return [{
        id: String(item.place_id ?? `${latitude},${longitude}`),
        label,
        address: item.display_name,
        latitude,
        longitude,
      }];
    }).slice(0, 5);
    this.setCache(cacheKey, places);
    return places;
  }

  async route(coordinates: Coordinate[], profile: RouteProfile): Promise<RoadRoute> {
    if (coordinates.length < 2 || coordinates.length > 25
      || coordinates.some(([longitude, latitude]) => !Number.isFinite(longitude)
        || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)) {
      throw new MapProviderError('invalid_request');
    }
    const cacheKey = `route:${profile}:${coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';')}`;
    const cached = this.getCache<RoadRoute>(cacheKey);
    if (cached) return cached;

    const encodedCoordinates = coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';');
    const url = new URL(`${providerBaseUrl}/directions/${profile}/${encodedCoordinates}`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'simplified');
    url.searchParams.set('steps', 'false');
    const response = await this.request(url);
    if (!response.ok) throw this.httpError(response.status);
    const body = await response.json() as LocationIqDirectionsResponse;
    const routes = Array.isArray(body.routes) ? body.routes : body.routes ? [body.routes] : [];
    const route = routes[0];
    const routeCoordinates = route?.geometry?.coordinates;
    if (!route || route.geometry?.type !== 'LineString' || !Array.isArray(routeCoordinates)
      || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      if (body.code === 'NoRoute' || routes.length === 0) throw new MapProviderError('no_route');
      throw new MapProviderError('unavailable');
    }

    const geometryCoordinates = routeCoordinates.filter((point): point is Coordinate =>
      Array.isArray(point) && point.length >= 2
      && typeof point[0] === 'number' && Number.isFinite(point[0])
      && typeof point[1] === 'number' && Number.isFinite(point[1])
      && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90);
    if (geometryCoordinates.length < 2) throw new MapProviderError('unavailable');

    const result: RoadRoute = {
      geometry: { type: 'LineString', coordinates: geometryCoordinates },
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      provider: 'LocationIQ',
    };
    this.setCache(cacheKey, result);
    return result;
  }

  private getCache<T>(key: string): T | null {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!cached) return null;
    if (cached.expiresAt <= this.now()) {
      this.cache.delete(key);
      return null;
    }
    return structuredClone(cached.value);
  }

  private setCache<T>(key: string, value: T): void {
    const now = this.now();
    for (const [entryKey, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(entryKey);
    }
    if (!this.cache.has(key) && this.cache.size >= maximumCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { expiresAt: now + cacheTtlMs, value: structuredClone(value) });
  }

  private async request(url: URL): Promise<Response> {
    if (!this.apiKey) throw new MapProviderError('disabled');
    const now = this.now();
    const utcDay = Math.floor(now / 86_400_000);
    if (utcDay !== this.currentUtcDay) {
      this.currentUtcDay = utcDay;
      this.dailyRequestCount = 0;
    }
    while (this.requestTimes.length) {
      const oldestRequest = this.requestTimes[0];
      if (oldestRequest === undefined || oldestRequest > now - 60_000) break;
      this.requestTimes.shift();
    }
    if (this.dailyRequestCount >= requestsPerDayLimit) throw new MapProviderError('daily_quota');
    if (this.requestTimes.length >= requestsPerMinuteLimit || now - this.lastRequestAt < minimumRequestIntervalMs) {
      throw new MapProviderError('rate_limited');
    }
    this.lastRequestAt = now;
    this.dailyRequestCount += 1;
    this.requestTimes.push(now);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetcher(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new MapProviderError('timeout');
      }
      throw new MapProviderError('unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  private httpError(status: number): MapProviderError {
    if (status === 429) return new MapProviderError('rate_limited');
    if (status === 400 || status === 404) return new MapProviderError('no_route');
    return new MapProviderError('unavailable');
  }
}