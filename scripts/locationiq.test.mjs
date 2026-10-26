import assert from 'node:assert/strict';
import test from 'node:test';
import { LocationIqAdapter, MapProviderError } from '../apps/api/src/maps/locationiq-adapter.ts';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('geocoding usa endpoint EU, limita dati, attribuisce e cachea al massimo 48 ore', async () => {
  let now = Date.UTC(2026, 9, 26, 12);
  const requests = [];
  const adapter = new LocationIqAdapter({
    apiKey: 'test-only-secret',
    now: () => now,
    fetcher: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return jsonResponse([
        { place_id: 12, display_name: 'Duomo, Milano, Italia', lat: '45.4642', lon: '9.19' },
        { place_id: 13, display_name: 'Invalid', lat: '91', lon: '0' },
      ]);
    },
  });

  const first = await adapter.searchPlaces('  Duomo, Milano  ', 'it');
  const cached = await adapter.searchPlaces('duomo, milano', 'it');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.hostname, 'eu1.locationiq.com');
  assert.equal(requests[0].url.searchParams.get('q'), 'Duomo, Milano');
  assert.equal(requests[0].url.searchParams.has('countrycodes'), false);
  assert.deepEqual(first, [{
    id: '12', label: 'Duomo', address: 'Duomo, Milano, Italia', latitude: 45.4642, longitude: 9.19,
  }]);
  assert.deepEqual(cached, first);
  assert.equal(JSON.stringify(first).includes('test-only-secret'), false);

  now += 48 * 60 * 60 * 1000 + 1;
  await adapter.searchPlaces('Duomo, Milano', 'it');
  assert.equal(requests.length, 2);
});

test('directions usa ordine longitude/latitude e restituisce solo la geometria normalizzata', async () => {
  let requestedUrl;
  const adapter = new LocationIqAdapter({
    apiKey: 'test-only-secret',
    fetcher: async (input) => {
      requestedUrl = new URL(String(input));
      return jsonResponse({
        code: 'Ok',
        routes: [{
          geometry: { type: 'LineString', coordinates: [[12.3, 45.4], [12.4, 45.5]] },
          distance: 12500,
          duration: 1800,
        }],
      });
    },
  });

  const route = await adapter.route([[12.3, 45.4], [12.4, 45.5]], 'driving');
  assert.equal(requestedUrl.hostname, 'eu1.locationiq.com');
  assert.match(requestedUrl.pathname, /directions\/driving\/12\.3,45\.4;12\.4,45\.5$/);
  assert.equal(requestedUrl.searchParams.get('geometries'), 'geojson');
  assert.deepEqual(route.geometry.coordinates, [[12.3, 45.4], [12.4, 45.5]]);
  assert.equal(route.distanceMeters, 12500);
  assert.equal(route.durationSeconds, 1800);
  assert.equal(route.provider, 'LocationIQ');
});

test('adapter impone limiti locali e non fa richieste se manca la chiave', async () => {
  let now = Date.UTC(2026, 9, 26, 12);
  let calls = 0;
  const adapter = new LocationIqAdapter({
    apiKey: 'test-only-secret',
    now: () => now,
    fetcher: async () => { calls += 1; return jsonResponse([]); },
  });
  await adapter.searchPlaces('Roma', 'it');
  await assert.rejects(adapter.searchPlaces('Milano', 'it'),
    (error) => error instanceof MapProviderError && error.code === 'rate_limited');
  assert.equal(calls, 1);

  const disabled = new LocationIqAdapter({ apiKey: '', fetcher: async () => { calls += 1; return jsonResponse([]); } });
  await assert.rejects(disabled.searchPlaces('Roma', 'it'),
    (error) => error instanceof MapProviderError && error.code === 'disabled');
  assert.equal(calls, 1);
  now += 1000;
});

test('timeout upstream diventa errore mappabile e non rivela dettagli di rete', async () => {
  const adapter = new LocationIqAdapter({
    apiKey: 'test-only-secret',
    timeoutMs: 5,
    fetcher: (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('request aborted', 'AbortError')), { once: true });
    }),
  });
  await assert.rejects(adapter.searchPlaces('Roma', 'it'),
    (error) => error instanceof MapProviderError && error.code === 'timeout');
});