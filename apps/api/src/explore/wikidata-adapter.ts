import type { ExploreCandidate, NearbyExploreRequest } from '@purrroute/contracts';

const endpoint = 'https://query.wikidata.org/sparql';
const queryTimeoutMs = 10_000;
const cacheTtlMs = 15 * 60 * 1000;
const maxCacheEntries = 100;
const categoryQids: Record<NearbyExploreRequest['category'], string> = {
  museum: 'Q33506',
  park: 'Q22698',
};

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface WikidataBinding {
  place?: { value?: unknown };
  placeLabel?: { value?: unknown };
  coordinate?: { value?: unknown };
}

interface WikidataResponse {
  results?: { bindings?: WikidataBinding[] };
}

interface CacheEntry {
  expiresAt: number;
  results: ExploreCandidate[];
}

export type WikidataExploreErrorCode = 'invalid_request' | 'rate_limited' | 'timeout' | 'unavailable';

export class WikidataExploreError extends Error {
  readonly code: WikidataExploreErrorCode;

  constructor(code: WikidataExploreErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface WikidataAdapterOptions {
  fetcher?: FetchFunction;
  now?: () => number;
  timeoutMs?: number;
}

function cacheKey(request: NearbyExploreRequest): string {
  return [request.category, request.radiusKm, request.locale,
    request.latitude.toFixed(4), request.longitude.toFixed(4)].join(':');
}

function distanceMeters(
  leftLatitude: number,
  leftLongitude: number,
  rightLatitude: number,
  rightLongitude: number,
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(rightLatitude - leftLatitude);
  const longitudeDelta = radians(rightLongitude - leftLongitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(leftLatitude)) * Math.cos(radians(rightLatitude))
      * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function parseCoordinate(value: unknown): { latitude: number; longitude: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^Point\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)$/.exec(value);
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function getCacheEntry(cache: Map<string, CacheEntry>, key: string, now: number): ExploreCandidate[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return structuredClone(entry.results);
}

export class WikidataExploreAdapter {
  private readonly fetcher: FetchFunction;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: WikidataAdapterOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? queryTimeoutMs;
  }

  async nearby(request: NearbyExploreRequest): Promise<ExploreCandidate[]> {
    if (!Number.isFinite(request.latitude) || request.latitude < -90 || request.latitude > 90
      || !Number.isFinite(request.longitude) || request.longitude < -180 || request.longitude > 180
      || ![1, 3, 5].includes(request.radiusKm)
      || !['museum', 'park'].includes(request.category)
      || !['it', 'en'].includes(request.locale)) {
      throw new WikidataExploreError('invalid_request');
    }

    const key = cacheKey(request);
    const cached = getCacheEntry(this.cache, key, this.now());
    if (cached) return cached;

    const center = `Point(${request.longitude.toFixed(6)} ${request.latitude.toFixed(6)})`;
    const query = [
      'SELECT ?place ?placeLabel ?coordinate ?distance WHERE {',
      'SERVICE wikibase:around { ?place wdt:P625 ?coordinate .',
      `bd:serviceParam wikibase:center "${center}"^^geo:wktLiteral .`,
      `bd:serviceParam wikibase:radius "${request.radiusKm}" .`,
      'bd:serviceParam wikibase:distance ?distance . }',
      `?place wdt:P31 wd:${categoryQids[request.category]} .`,
      `SERVICE wikibase:label { bd:serviceParam wikibase:language "${request.locale},en". }`,
      '} ORDER BY ?distance LIMIT 10',
    ].join(' ');

    const body = new URLSearchParams({ query, format: 'json' });
    let response: Response;
    try {
      response = await this.fetcher(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          accept: 'application/sparql-results+json',
          'user-agent': 'purrRoute/0.9 (nearby cultural places)',
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') throw new WikidataExploreError('timeout');
      throw new WikidataExploreError('unavailable');
    }
    if (response.status === 429) throw new WikidataExploreError('rate_limited');
    if (!response.ok) throw new WikidataExploreError('unavailable');

    let payload: WikidataResponse;
    try { payload = await response.json() as WikidataResponse; }
    catch { throw new WikidataExploreError('unavailable'); }
    if (!Array.isArray(payload.results?.bindings)) throw new WikidataExploreError('unavailable');

    const deduplicated = new Map<string, ExploreCandidate>();
    for (const binding of payload.results.bindings) {
      const entityUrl = binding.place?.value;
      const label = binding.placeLabel?.value;
      const point = parseCoordinate(binding.coordinate?.value);
      if (typeof entityUrl !== 'string' || typeof label !== 'string' || !label.trim() || !point) continue;
      const entityId = /\/entity\/(Q[1-9][0-9]*)$/.exec(entityUrl)?.[1];
      if (!entityId || deduplicated.has(entityId)) continue;
      const distance = distanceMeters(request.latitude, request.longitude, point.latitude, point.longitude);
      if (distance > request.radiusKm * 1000) continue;
      deduplicated.set(entityId, {
        id: entityId,
        label: label.trim().slice(0, 200),
        latitude: point.latitude,
        longitude: point.longitude,
        distanceMeters: Math.round(distance),
        category: request.category,
      });
    }

    const results = [...deduplicated.values()]
      .sort((left, right) => left.distanceMeters - right.distanceMeters || left.id.localeCompare(right.id))
      .slice(0, 20);
    this.cache.set(key, { expiresAt: this.now() + cacheTtlMs, results: structuredClone(results) });
    while (this.cache.size > maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }
    return results;
  }
}