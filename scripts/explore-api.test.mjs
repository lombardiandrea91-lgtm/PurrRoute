import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../apps/api/src/server.ts';
import { WikidataExploreError } from '../apps/api/src/explore/wikidata-adapter.ts';

const result = {
  id: 'Q123456', label: 'Museo di prova', latitude: 41.9, longitude: 12.5,
  distanceMeters: 120, category: 'museum',
};
const requestBody = {
  latitude: 41.9028, longitude: 12.4964, radiusKm: 3, category: 'museum', locale: 'it',
};

test('Explore richiede CSRF/Origin, valida i filtri e mappa il rate limit Wikidata', async (context) => {
  let calls = 0;
  const app = buildServer({
    explore: {
      nearby: async () => { calls += 1; return [result]; },
    },
  });
  context.after(() => app.close());

  const csrf = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  const headers = {
    cookie: String(csrf.headers['set-cookie']).split(';')[0],
    'content-type': 'application/json',
    origin: 'http://localhost:5173',
    'x-csrf-token': csrf.json().csrfToken,
  };
  const noCsrf = await app.inject({
    method: 'POST', url: '/api/explore/nearby', headers: { ...headers, 'x-csrf-token': '' }, payload: requestBody,
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(calls, 0);

  const invalid = await app.inject({
    method: 'POST', url: '/api/explore/nearby', headers,
    payload: { ...requestBody, radiusKm: 50 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(calls, 0);

  const ok = await app.inject({ method: 'POST', url: '/api/explore/nearby', headers, payload: requestBody });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().attribution, 'Wikidata');
  assert.equal(ok.json().results[0].id, 'Q123456');
  assert.equal(calls, 1);

  const deniedOrigin = await app.inject({
    method: 'POST', url: '/api/explore/nearby', headers: { ...headers, origin: 'https://other.example' },
    payload: requestBody,
  });
  assert.equal(deniedOrigin.statusCode, 403);
  assert.equal(calls, 1);

  const limited = buildServer({ explore: {
    nearby: async () => { throw new WikidataExploreError('rate_limited'); },
  } });
  context.after(() => limited.close());
  const limitedCsrf = await limited.inject({ method: 'GET', url: '/api/auth/csrf' });
  const response = await limited.inject({
    method: 'POST', url: '/api/explore/nearby',
    headers: {
      cookie: String(limitedCsrf.headers['set-cookie']).split(';')[0],
      'content-type': 'application/json', origin: 'http://localhost:5173',
      'x-csrf-token': limitedCsrf.json().csrfToken,
    },
    payload: requestBody,
  });
  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.json(), { error: 'explore_rate_limited' });
});