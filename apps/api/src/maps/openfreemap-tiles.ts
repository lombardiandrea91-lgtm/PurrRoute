import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const providerOrigin = 'https://tiles.openfreemap.org';
const applicationUserAgent = 'purrRoute-PWA/1.0 (offline map tile download)';

export type TileFetcher = (url: string, init: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rewriteProviderUrl(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value === `${providerOrigin}/planet`) return '/api/maps/tiles/planet.json';
  if (value === `${providerOrigin}/fonts/{fontstack}/{range}.pbf`) {
    return '/api/maps/tiles/fonts/{fontstack}/{range}.pbf';
  }
  if (value.startsWith(`${providerOrigin}/sprites/ofm_f384/ofm`)) {
    return value.replace(`${providerOrigin}/sprites/ofm_f384/ofm`, '/api/maps/tiles/sprites/ofm_f384/ofm');
  }
  if (value.startsWith(`${providerOrigin}/natural_earth/`)) {
    return value.replace(`${providerOrigin}/natural_earth/`, '/api/maps/tiles/natural_earth/');
  }
  if (value.startsWith(`${providerOrigin}/planet/`)) {
    return value.replace(`${providerOrigin}/planet/`, '/api/maps/tiles/planet/');
  }
  return value;
}

function rewriteStyle(value: unknown): unknown {
  if (!isRecord(value)) throw new Error('invalid_provider_style');
  const style = structuredClone(value);
  if (isRecord(style.sources)) {
    for (const source of Object.values(style.sources)) {
      if (!isRecord(source)) continue;
      if (Array.isArray(source.tiles)) source.tiles = source.tiles.map(rewriteProviderUrl);
      if ('url' in source) source.url = rewriteProviderUrl(source.url);
    }
  }
  if ('glyphs' in style) style.glyphs = rewriteProviderUrl(style.glyphs);
  if ('sprite' in style) style.sprite = rewriteProviderUrl(style.sprite);
  return style;
}

function providerPath(assetPath: string): string | null {
  const segments = assetPath.split('/').map((segment) => {
    try { return decodeURIComponent(segment); } catch { return ''; }
  });
  const [kind, second, third, fourth, fifth] = segments;
  if (kind === 'planet' && second === 'json' && segments.length === 2) return '/planet';
  if (kind === 'planet' && (segments.length === 4 || segments.length === 5)) {
    const versioned = segments.length === 5;
    const version = versioned ? second : null;
    const zoomValue = segments[versioned ? 2 : 1];
    const xValue = segments[versioned ? 3 : 2];
    const yValue = segments[versioned ? 4 : 3];
    if ((version === null || /^\d{8}_\d{6}_[a-z]{2}$/.test(version ?? ''))
      && /^\d{1,2}$/.test(zoomValue ?? '') && /^\d{1,7}$/.test(xValue ?? '')
      && /^\d{1,7}\.pbf$/.test(yValue ?? '')) {
      const zoom = Number(zoomValue);
      const x = Number(xValue);
      const y = Number((yValue ?? '').slice(0, -4));
      if (zoom <= 19 && x < 2 ** zoom && y < 2 ** zoom) {
        return `/planet/${version ? `${version}/` : ''}${zoom}/${x}/${y}.pbf`;
      }
    }
  }
  if (kind === 'natural_earth' && second === 'ne2sr' && segments.length === 5
    && /^\d$/.test(third ?? '') && /^\d{1,3}$/.test(fourth ?? '') && /^\d{1,3}\.png$/.test(fifth ?? '')) {
    const zoom = Number(third);
    const x = Number(fourth);
    const y = Number((fifth ?? '').slice(0, -4));
    if (zoom <= 6 && x < 2 ** zoom && y < 2 ** zoom) return `/natural_earth/ne2sr/${zoom}/${x}/${y}.png`;
  }
  if (kind === 'fonts' && segments.length === 3 && /^[A-Za-z0-9 _,.-]{1,160}$/.test(second ?? '')
    && /^\d{1,5}-\d{1,5}\.pbf$/.test(third ?? '')) {
    return `/fonts/${encodeURIComponent(second ?? '')}/${third}`;
  }
  if (kind === 'sprites' && second === 'ofm_f384' && segments.length === 3
    && /^ofm(?:@2x)?\.(?:json|png)$/.test(third ?? '')) {
    return `/sprites/ofm_f384/${third}`;
  }
  return null;
}

export class OpenFreeMapTiles {
  private readonly fetcher: TileFetcher;

  constructor(fetcher: TileFetcher = fetch) {
    this.fetcher = fetcher;
  }

  private async fetchProvider(path: string): Promise<Response> {
    const response = await this.fetcher(`${providerOrigin}${path}`, {
      headers: { 'user-agent': applicationUserAgent },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('tile_provider_unavailable');
    return response;
  }

  async style(): Promise<unknown> {
    const response = await this.fetchProvider('/styles/positron');
    return rewriteStyle(await response.json());
  }

  async tileJson(): Promise<unknown> {
    const response = await this.fetchProvider('/planet');
    const tileJson = await response.json() as unknown;
    if (!isRecord(tileJson) || !Array.isArray(tileJson.tiles)) throw new Error('invalid_provider_tilejson');
    return { ...tileJson, tiles: tileJson.tiles.map(rewriteProviderUrl) };
  }

  async asset(assetPath: string, reply: FastifyReply): Promise<unknown> {
    const path = providerPath(assetPath);
    if (!path) return reply.code(404).send({ error: 'tile_not_found' });
    try {
      const response = await this.fetchProvider(path);
      const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=604800');
      return reply.send(Buffer.from(await response.arrayBuffer()));
    } catch {
      return reply.code(503).send({ error: 'tile_provider_unavailable' });
    }
  }
}

export function registerOpenFreeMapTileRoutes(
  app: FastifyInstance,
  tiles = new OpenFreeMapTiles(),
): void {
  app.get('/api/maps/tiles/style.json', async (_request, reply) => {
    try {
      reply.header('Cache-Control', 'public, max-age=86400');
      return await tiles.style();
    } catch {
      return reply.code(503).send({ error: 'tile_provider_unavailable' });
    }
  });
  app.get('/api/maps/tiles/planet.json', async (_request, reply) => {
    try {
      reply.header('Cache-Control', 'public, max-age=86400');
      return await tiles.tileJson();
    } catch {
      return reply.code(503).send({ error: 'tile_provider_unavailable' });
    }
  });
  app.get<{ Params: { '*': string } }>('/api/maps/tiles/*', {
    config: { rateLimit: { max: 3200, timeWindow: '1 hour' } },
  }, async (
    request: FastifyRequest<{ Params: { '*': string } }>,
    reply,
  ) => tiles.asset(request.params['*'], reply));
}