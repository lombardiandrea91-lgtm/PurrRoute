import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../apps/api/src/server.ts';
import { MapProviderError } from '../apps/api/src/maps/locationiq-adapter.ts';

async function getCsrfHeaders(app) {
  const response = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  return {
    cookie: String(response.headers['set-cookie']).split(';')[0],
    'content-type': 'application/json',
    origin: 'http://localhost:5173',
    'x-csrf-token': response.json().csrfToken,
  };
}

test('ricerca e routing server richiedono Origin/CSRF e passano dati validati all’adapter', async (context) => {
  const calls = [];
  const app = buildServer({
    maps: {
      searchPlaces: async (query, locale) => {
        calls.push({ method: 'search', query, locale });
        return [{ id: 'place-1', label: 'Duomo', address: 'Duomo, Milano', latitude: 45.46, longitude: 9.19 }];
      },
      route: async (coordinates, profile) => {
        calls.push({ method: 'route', coordinates, profile });
        return {
          geometry: { type: 'LineString', coordinates },
          distanceMeters: 1200,
          durationSeconds: 600,
          provider: 'test',
        };
      },
    },
  });
  context.after(() => app.close());
  const headers = await getCsrfHeaders(app);

  const search = await app.inject({
    method: 'POST', url: '/api/maps/search', headers,
    payload: { query: 'Duomo, Milano', locale: 'it' },
  });
  assert.equal(search.statusCode, 200);
  assert.equal(search.json().results[0].label, 'Duomo');
  assert.equal(search.json().attribution, 'Search by LocationIQ.com');

  const route = await app.inject({
    method: 'POST', url: '/api/maps/route', headers,
    payload: { coordinates: [[9.19, 45.46], [9.2, 45.47]], profile: 'walking' },
  });
  assert.equal(route.statusCode, 200);
  assert.equal(route.json().provider, 'test');
  assert.equal(calls.length, 2);

  const invalid = await app.inject({
    method: 'POST', url: '/api/maps/route', headers,
    payload: { coordinates: [[9.19, 91], [9.2, 45.47]], profile: 'walking' },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(calls.length, 2);

  const denied = await app.inject({
    method: 'POST', url: '/api/maps/search',
    headers: { ...headers, origin: 'https://attacker.example' },
    payload: { query: 'Duomo, Milano', locale: 'it' },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(calls.length, 2);
});

test('geocoding e routing non contattano provider senza chiave e normalizzano quota esaurita', async (context) => {
  const app = buildServer();
  context.after(() => app.close());
  const headers = await getCsrfHeaders(app);

  const search = await app.inject({
    method: 'POST', url: '/api/maps/search', headers,
    payload: { query: 'Roma', locale: 'it' },
  });
  assert.equal(search.statusCode, 503);
  assert.deepEqual(search.json(), { error: 'geocoding_not_configured' });

  const quotaApp = buildServer({
    maps: {
      searchPlaces: async () => { throw new MapProviderError('daily_quota'); },
      route: async () => { throw new MapProviderError('rate_limited'); },
    },
  });
  context.after(() => quotaApp.close());
  const quotaHeaders = await getCsrfHeaders(quotaApp);
  const quota = await quotaApp.inject({
    method: 'POST', url: '/api/maps/search', headers: quotaHeaders,
    payload: { query: 'Roma', locale: 'it' },
  });
  assert.equal(quota.statusCode, 429);
  assert.deepEqual(quota.json(), { error: 'daily_quota' });
});