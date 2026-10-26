import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../apps/api/src/server.ts';

test('l’API espone health con risposta tipizzata', async (context) => {
  const app = buildServer();
  context.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

test('il client può ottenere token CSRF senza esporre il cookie a JavaScript', async (context) => {
  const app = buildServer();
  context.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  const cookies = response.headers['set-cookie'];

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.json().csrfToken, 'string');
  assert.match(String(cookies), /HttpOnly/i);
  assert.match(String(cookies), /SameSite=Strict/i);
});

test('l’endpoint registrazione applica validazione, Origin e CSRF prima del servizio', async (context) => {
  let registrations = 0;
  const app = buildServer({
    auth: {
      register: async () => {
        registrations += 1;
        return { accepted: true };
      },
    },
  });
  context.after(() => app.close());

  const csrfResponse = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  const csrfCookie = String(csrfResponse.headers['set-cookie']).split(';')[0];
  const headers = {
    cookie: csrfCookie,
    'content-type': 'application/json',
    'origin': 'http://localhost:5173',
    'x-csrf-token': csrfResponse.json().csrfToken,
  };
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers,
    payload: { email: 'gatto@example.test', password: 'short', role: 'owner' },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(registrations, 0);

  const valid = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers,
    payload: { email: 'gatto@example.test', password: 'correct-horse-battery' },
  });
  assert.equal(valid.statusCode, 202);
  assert.deepEqual(valid.json(), { accepted: true });
  assert.equal(registrations, 1);

  const denied = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { ...headers, origin: 'https://attacker.example' },
    payload: { email: 'gatto@example.test', password: 'correct-horse-battery' },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(registrations, 1);
});

test('login consegna la sessione solo via cookie HttpOnly, mai nel JSON', async (context) => {
  const account = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'gatto@example.test',
    emailVerifiedAt: '2026-10-26T12:00:00.000Z',
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  };
  const app = buildServer({
    auth: {
      login: async () => ({
        account,
        sessionToken: 'opaque-session-token',
        expiresAt: '2026-11-02T12:00:00.000Z',
      }),
    },
  });
  context.after(() => app.close());

  const csrfResponse = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: {
      cookie: String(csrfResponse.headers['set-cookie']).split(';')[0],
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'x-csrf-token': csrfResponse.json().csrfToken,
    },
    payload: { email: 'gatto@example.test', password: 'correct-horse-battery' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    account,
    expiresAt: '2026-11-02T12:00:00.000Z',
  });
  assert.match(String(response.headers['set-cookie']), /opaque-session-token/);
  assert.match(String(response.headers['set-cookie']), /HttpOnly/i);
});