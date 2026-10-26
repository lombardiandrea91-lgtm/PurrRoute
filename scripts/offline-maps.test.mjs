import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenFreeMapTiles } from '../apps/api/src/maps/openfreemap-tiles.ts';
import { createOfflineTilePlan, MAX_OFFLINE_TILES } from '../apps/web/src/maps/offline.ts';

test('proxy tile riscrive style/TileJSON e identifica il client nei fetch upstream', async () => {
  const calls = [];
  const tiles = new OpenFreeMapTiles(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/styles/positron')) {
      return new Response(JSON.stringify({
        version: 8,
        glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
        sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
        sources: {
          openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
          relief: { type: 'raster', tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'] },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const style = await tiles.style();
  assert.equal(style.glyphs, '/api/maps/tiles/fonts/{fontstack}/{range}.pbf');
  assert.equal(style.sprite, '/api/maps/tiles/sprites/ofm_f384/ofm');
  assert.equal(style.sources.openmaptiles.url, '/api/maps/tiles/planet.json');
  assert.equal(style.sources.relief.tiles[0], '/api/maps/tiles/natural_earth/ne2sr/{z}/{x}/{y}.png');
  assert.equal((await tiles.tileJson()).tiles[0], '/api/maps/tiles/planet/{z}/{x}/{y}.pbf');
  assert.equal(calls.every((call) => call.init.headers['user-agent'].startsWith('purrRoute-PWA/')), true);
});

test('proxy tile serve solo risorse allowlist e rifiuta coordinate fuori zoom', async () => {
  const calls = [];
  const tiles = new OpenFreeMapTiles(async (url) => {
    calls.push(url);
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'application/x-protobuf' } });
  });
  const sent = [];
  const reply = {
    code(status) { sent.push({ status }); return this; },
    header(name, value) { sent.push({ name, value }); return this; },
    send(value) { sent.push({ body: value }); return value; },
  };

  await tiles.asset('planet/2/1/3.pbf', reply);
  assert.equal(calls[0], 'https://tiles.openfreemap.org/planet/2/1/3.pbf');
  assert.equal(sent.find((item) => item.name === 'Content-Type').value, 'application/x-protobuf');
  await tiles.asset('planet/20261018_080001_pt/2/1/3.pbf', reply);
  assert.equal(calls[1], 'https://tiles.openfreemap.org/planet/20261018_080001_pt/2/1/3.pbf');
  await tiles.asset('planet/2/4/0.pbf', reply);
  await tiles.asset('https://evil.example/private', reply);
  assert.equal(calls.length, 2);
  assert.equal(sent.filter((item) => item.status === 404).length, 2);
});

test('planner offline limita ogni area a 3.000 tile e include style, glyph e sprite', () => {
  const style = { layers: [{ layout: { 'text-font': ['Noto Sans Regular', 'Noto Sans Symbols Regular'] } }] };
  const plan = createOfflineTilePlan([-0.2, 51.4, 0.2, 51.7], 9, style);
  assert.ok(plan);
  assert.ok(plan.tileCount > 0 && plan.tileCount <= MAX_OFFLINE_TILES);
  assert.ok(plan.urls.includes('/api/maps/tiles/style.json'));
  assert.ok(plan.urls.some((url) => url.includes('/fonts/Noto%20Sans%20Regular%2CNoto%20Sans%20Symbols%20Regular/')));
  assert.ok(plan.urls.includes('/api/maps/tiles/sprites/ofm_f384/ofm@2x.png'));

  const continent = createOfflineTilePlan([-15, 34, 35, 72], 13, style);
  assert.ok(continent);
  assert.ok(continent.tileCount <= MAX_OFFLINE_TILES);
  const versioned = createOfflineTilePlan([-0.2, 51.4, 0.2, 51.7], 9, style,
    '/api/maps/tiles/planet/20261018_080001_pt/{z}/{x}/{y}.pbf');
  assert.ok(versioned?.urls.some((url) => url.startsWith('/api/maps/tiles/planet/20261018_080001_pt/')));
  assert.equal(createOfflineTilePlan([-181, 0, 181, 90], 8, style), null);
});