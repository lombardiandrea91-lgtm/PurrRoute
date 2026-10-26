import assert from 'node:assert/strict';
import test from 'node:test';
import { WikidataExploreAdapter, WikidataExploreError } from '../apps/api/src/explore/wikidata-adapter.ts';

const request = {
  latitude: 41.9028,
  longitude: 12.4964,
  radiusKm: 3,
  category: 'museum',
  locale: 'it',
};

function binding(id, label, longitude, latitude) {
  return {
    place: { value: `http://www.wikidata.org/entity/${id}` },
    placeLabel: { value: label },
    coordinate: { value: `Point(${longitude} ${latitude})` },
  };
}

test('Explore Wikidata deduplica QID e classifica per distanza locale', async () => {
  const calls = [];
  const adapter = new WikidataExploreAdapter({
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ results: { bindings: [
        binding('Q100', 'Museo A', 12.50, 41.903),
        binding('Q101', 'Museo B', 12.4965, 41.9028),
        binding('Q100', 'Museo A duplicato', 12.50, 41.903),
        binding('Q102', '', 12.4964, 41.9028),
        { ...binding('Q103', 'Fuori area', 13, 41.9), coordinate: { value: 'invalid' } },
      ] } }), { status: 200, headers: { 'content-type': 'application/sparql-results+json' } });
    },
  });

  const results = await adapter.nearby(request);
  assert.equal(results.length, 2);
  assert.equal(results[0].id, 'Q101');
  assert.equal(results[1].id, 'Q100');
  assert.equal(results[0].category, 'museum');
  assert.equal(results[0].distanceMeters < results[1].distanceMeters, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://query.wikidata.org/sparql');
  assert.match(calls[0].init.headers['user-agent'], /^purrRoute\//);
  const query = new URLSearchParams(calls[0].init.body).get('query');
  assert.match(query, /wd:Q33506/);
  assert.match(query, /wikibase:radius.*"3"/);
  assert.match(query, /wdt:P31 wd:Q33506/);
  assert.match(query, /LIMIT 10/);

  const cached = await adapter.nearby(request);
  assert.deepEqual(cached, results);
  assert.equal(calls.length, 1);
});

test('Explore rifiuta input fuori contratto e non riprova dopo HTTP 429', async () => {
  let calls = 0;
  const adapter = new WikidataExploreAdapter({
    fetcher: async () => { calls += 1; return new Response('', { status: 429 }); },
  });
  await assert.rejects(adapter.nearby({ ...request, radiusKm: 50 }),
    (error) => error instanceof WikidataExploreError && error.code === 'invalid_request');
  await assert.rejects(adapter.nearby(request),
    (error) => error instanceof WikidataExploreError && error.code === 'rate_limited');
  assert.equal(calls, 1);
});