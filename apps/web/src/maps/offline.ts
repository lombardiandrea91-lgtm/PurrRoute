export const OFFLINE_MAP_CACHE = 'purrroute-map-tiles';
export const MAX_OFFLINE_TILES = 3000;
export const MAX_OFFLINE_BYTES = 50 * 1024 * 1024;

export type OfflineBounds = [west: number, south: number, east: number, north: number];

export interface OfflineTilePlan {
  urls: string[];
  tileCount: number;
  minZoom: number;
  maxZoom: number;
}

function tileX(longitude: number, zoom: number): number {
  const count = 2 ** zoom;
  return Math.max(0, Math.min(count - 1, Math.floor(((longitude + 180) / 360) * count)));
}

function tileY(latitude: number, zoom: number): number {
  const count = 2 ** zoom;
  const radians = Math.PI * Math.max(-85.05112878, Math.min(85.05112878, latitude)) / 180;
  const value = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * count;
  return Math.max(0, Math.min(count - 1, Math.floor(value)));
}

function tileCoordinates(bounds: OfflineBounds, zoom: number): Array<[number, number]> {
  const [west, south, east, north] = bounds;
  const firstX = tileX(west, zoom);
  const lastX = tileX(east, zoom);
  const firstY = tileY(north, zoom);
  const lastY = tileY(south, zoom);
  const count = 2 ** zoom;
  const coordinates: Array<[number, number]> = [];
  let x = firstX;
  while (true) {
    for (let y = firstY; y <= lastY; y += 1) coordinates.push([x, y]);
    if (x === lastX) break;
    x = (x + 1) % count;
  }
  return coordinates;
}

function tileCoordinateCount(bounds: OfflineBounds, zoom: number): number {
  const [west, south, east, north] = bounds;
  const firstX = tileX(west, zoom);
  const lastX = tileX(east, zoom);
  const firstY = tileY(north, zoom);
  const lastY = tileY(south, zoom);
  const columns = firstX <= lastX
    ? lastX - firstX + 1
    : 2 ** zoom - firstX + lastX + 1;
  return columns * (lastY - firstY + 1);
}

function fontsInStyle(style: unknown): string[] {
  if (!style || typeof style !== 'object' || !('layers' in style) || !Array.isArray(style.layers)) return [];
  const fonts = new Set<string>();
  for (const layer of style.layers) {
    if (!layer || typeof layer !== 'object' || !('layout' in layer) || !layer.layout
      || typeof layer.layout !== 'object' || !('text-font' in layer.layout)) continue;
    const font = layer.layout['text-font'];
    if (Array.isArray(font) && font.every((part) => typeof part === 'string')) fonts.add(font.join(','));
  }
  return [...fonts];
}

function createPlan(
  bounds: OfflineBounds,
  minZoom: number,
  maxZoom: number,
  style: unknown,
  vectorTileTemplate: string,
): OfflineTilePlan {
  const tileUrls = new Set<string>();
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    for (const [x, y] of tileCoordinates(bounds, zoom)) {
      tileUrls.add(vectorTileTemplate.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)));
      if (zoom <= 6) tileUrls.add(`/api/maps/tiles/natural_earth/ne2sr/${zoom}/${x}/${y}.png`);
    }
  }
  const tileCount = tileUrls.size;
  const urls = new Set([
    '/api/maps/tiles/style.json',
    '/api/maps/tiles/planet.json',
    '/api/maps/tiles/sprites/ofm_f384/ofm.json',
    '/api/maps/tiles/sprites/ofm_f384/ofm.png',
    '/api/maps/tiles/sprites/ofm_f384/ofm@2x.json',
    '/api/maps/tiles/sprites/ofm_f384/ofm@2x.png',
    ...tileUrls,
  ]);
  for (const font of fontsInStyle(style)) {
    const encoded = encodeURIComponent(font);
    for (const range of [0, 256, 512]) {
      urls.add(`/api/maps/tiles/fonts/${encoded}/${range}-${range + 255}.pbf`);
    }
  }
  return { urls: [...urls], tileCount, minZoom, maxZoom };
}

export function createOfflineTilePlan(
  bounds: OfflineBounds,
  viewportZoom: number,
  style: unknown,
  vectorTileTemplate = '/api/maps/tiles/planet/{z}/{x}/{y}.pbf',
): OfflineTilePlan | null {
  const [west, south, east, north] = bounds;
  if (![west, south, east, north, viewportZoom].every(Number.isFinite)
    || west < -180 || west > 180 || east < -180 || east > 180
    || south < -90 || south > 90 || north < -90 || north > 90 || south > north
    || !/^\/api\/maps\/tiles\/planet\/(?:\d{8}_\d{6}_[a-z]{2}\/)?\{z\}\/\{x\}\/\{y\}\.pbf$/.test(vectorTileTemplate)) return null;
  const preferredMaxZoom = Math.max(6, Math.min(14, Math.ceil(viewportZoom) + 2));
  for (let maxZoom = preferredMaxZoom; maxZoom >= 3; maxZoom -= 1) {
    const minZoom = Math.max(3, maxZoom - 3);
    let count = 0;
    for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
      const tiles = tileCoordinateCount(bounds, zoom);
      count += tiles * (zoom <= 6 ? 2 : 1);
    }
    if (count <= MAX_OFFLINE_TILES) return createPlan(bounds, minZoom, maxZoom, style, vectorTileTemplate);
  }
  return null;
}

export async function readOfflineMapCount(): Promise<number> {
  if (!('caches' in window)) return 0;
  const cache = await caches.open(OFFLINE_MAP_CACHE);
  return (await cache.keys()).length;
}

export async function clearOfflineMaps(): Promise<void> {
  if ('caches' in window) await caches.delete(OFFLINE_MAP_CACHE);
}

export async function downloadOfflineTilePlan(
  plan: OfflineTilePlan,
  onProgress: (completed: number, total: number) => void,
): Promise<void> {
  if (plan.tileCount > MAX_OFFLINE_TILES || plan.urls.length > 3200) {
    throw new Error('offline_area_too_large');
  }
  if (!navigator.onLine || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    throw new Error('offline_cache_unavailable');
  }
  await clearOfflineMaps();
  let nextIndex = 0;
  let completed = 0;
  let totalBytes = 0;
  const downloadOne = async () => {
    while (nextIndex < plan.urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      const response = await fetch(plan.urls[index] as string);
      if (!response.ok) throw new Error('offline_download_failed');
      totalBytes += (await response.clone().arrayBuffer()).byteLength;
      if (totalBytes > MAX_OFFLINE_BYTES) throw new Error('offline_download_too_large');
      completed += 1;
      onProgress(completed, plan.urls.length);
    }
  };
  try {
    await Promise.all(Array.from({ length: 4 }, () => downloadOne()));
  } catch (error) {
    await clearOfflineMaps();
    throw error;
  }
}