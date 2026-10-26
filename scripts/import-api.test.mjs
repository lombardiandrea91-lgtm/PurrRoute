import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../apps/api/src/server.ts';
import { LinkImportError, LinkMetadataAdapter } from '../apps/api/src/import/link-metadata-adapter.ts';

test('la preview link richiede CSRF e Origin, applica un rate limit e non salva bozze', async (context) => {
  const requested = [];
  const app = buildServer({
    linkImport: {
      async preview(url) {
        requested.push(url);
        if (url === 'https://blocked.example/place') throw new LinkImportError();
        return { title: 'Museo di prova', description: 'Descrizione', sourceUrl: url };
      },
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
  const body = { url: 'https://example.test/place' };
  const deniedCsrf = await app.inject({
    method: 'POST', url: '/api/import/link-preview', headers: { ...headers, 'x-csrf-token': '' }, payload: body,
  });
  assert.equal(deniedCsrf.statusCode, 403);
  assert.equal(requested.length, 0);

  const invalid = await app.inject({ method: 'POST', url: '/api/import/link-preview', headers, payload: { url: 'nope' } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(requested.length, 0);

  const blocked = await app.inject({
    method: 'POST', url: '/api/import/link-preview', headers,
    payload: { url: 'https://blocked.example/place' },
  });
  assert.equal(blocked.statusCode, 422);
  assert.deepEqual(blocked.json(), { error: 'link_preview_blocked' });

  const ok = await app.inject({ method: 'POST', url: '/api/import/link-preview', headers, payload: body });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), {
    title: 'Museo di prova', description: 'Descrizione', sourceUrl: body.url,
  });
  assert.equal(ok.headers['cache-control'], 'no-store');
  assert.equal(ok.headers['x-ratelimit-limit'], '5');

  const deniedOrigin = await app.inject({
    method: 'POST', url: '/api/import/link-preview', headers: { ...headers, origin: 'https://other.example' }, payload: body,
  });
  assert.equal(deniedOrigin.statusCode, 403);
  assert.equal(requested.length, 2);

  const repeatedStatuses = [];
  for (let index = 0; index < 8; index += 1) {
    const repeated = await app.inject({ method: 'POST', url: '/api/import/link-preview', headers, payload: body });
    repeatedStatuses.push(repeated.statusCode);
  }
  assert.ok(repeatedStatuses.includes(429), `expected rate limit; received ${repeatedStatuses.join(', ')}`);
});

test('il fetcher rifiuta HTTP, credenziali e IP di loopback prima di leggere la pagina', async () => {
  const adapter = new LinkMetadataAdapter();
  await assert.rejects(adapter.preview('http://example.test/place'), LinkImportError);
  await assert.rejects(adapter.preview('https://user:pass@example.test/place'), LinkImportError);
  await assert.rejects(adapter.preview('https://127.0.0.1/place'), LinkImportError);
});

test('la preview estrae metadati e blocca i percorsi vietati da robots.txt', async () => {
  const requests = [];
  const adapter = new LinkMetadataAdapter(async (url) => {
    requests.push(url.pathname);
    if (url.pathname === '/robots.txt') {
      return { statusCode: 200, headers: {}, body: 'User-agent: *\nDisallow: /private' };
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: '<title>Fallback</title><meta property="og:title" content="Museo prova"><script type="application/ld+json">{"@type":"Place","description":"Descrizione strutturata"}</script>',
    };
  });
  const preview = await adapter.preview('https://example.test/public-place');
  assert.equal(preview.title, 'Museo prova');
  assert.equal(preview.description, 'Descrizione strutturata');
  assert.equal(preview.sourceUrl, 'https://example.test/public-place');
  assert.deepEqual(requests, ['/robots.txt', '/public-place']);

  requests.length = 0;
  await assert.rejects(adapter.preview('https://example.test/private/place'), LinkImportError);
  assert.deepEqual(requests, ['/robots.txt']);
});