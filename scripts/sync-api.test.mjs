import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../apps/api/src/server.ts';

const account = {
  id: '30000000-0000-4000-8000-000000000001',
  email: 'owner@example.test',
  emailVerifiedAt: '2026-10-26T12:00:00.000Z',
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};
const current = {
  version: 1,
  trip: {
    id: '30000000-0000-4000-8000-000000000002', title: 'Roma', description: null,
    startsOn: null, endsOn: null, timeZone: null, revision: 1,
    createdAt: '2026-10-26T12:00:00.000Z', updatedAt: '2026-10-26T12:00:00.000Z', deletedAt: null,
  },
  days: [],
  stops: [],
  lists: [],
  listItems: [],
  expenses: [],
  syncedAt: '2026-10-26T12:00:00.000Z',
};

test('sync HTTP richiede sessione e protegge push con Origin e CSRF', async (context) => {
  let calls = 0;
  const app = buildServer({
    auth: {
      authenticate: async (token) => token === 'session-ok' ? { account, expiresAt: '2026-11-02T12:00:00.000Z' } : null,
    },
    sync: {
      listTrips: async (userId) => userId === account.id ? [current] : [],
      getTrip: async (userId) => userId === account.id ? current : null,
      pushTrip: async () => { calls += 1; return { kind: 'conflict', current }; },
    },
  });
  context.after(() => app.close());

  const denied = await app.inject({ method: 'GET', url: `/api/sync/trips/${current.trip.id}` });
  assert.equal(denied.statusCode, 401);
  const deniedList = await app.inject({ method: 'GET', url: '/api/sync/trips' });
  assert.equal(deniedList.statusCode, 401);

  const csrf = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  const headers = {
    cookie: `${String(csrf.headers['set-cookie']).split(';')[0]}; purrroute_session=session-ok`,
    'content-type': 'application/json',
    origin: 'http://localhost:5173',
    'x-csrf-token': csrf.json().csrfToken,
  };
  const cloudList = await app.inject({
    method: 'GET', url: '/api/sync/trips',
    headers: { cookie: 'purrroute_session=session-ok' },
  });
  assert.equal(cloudList.statusCode, 200);
  assert.equal(cloudList.json().length, 1);
  const noCsrf = await app.inject({
    method: 'POST', url: '/api/sync/trips', headers: { ...headers, 'x-csrf-token': '' },
    payload: { expectedVersion: 0, trip: current.trip, days: [], stops: [], lists: [], listItems: [], expenses: [] },
  });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(calls, 0);

  const conflict = await app.inject({
    method: 'POST', url: '/api/sync/trips', headers,
    payload: { expectedVersion: 0, trip: current.trip, days: [], stops: [], lists: [], listItems: [], expenses: [] },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().current.version, 1);
  assert.equal(calls, 1);

  const originDenied = await app.inject({
    method: 'POST', url: '/api/sync/trips', headers: { ...headers, origin: 'https://other.example' },
    payload: { expectedVersion: 0, trip: current.trip, days: [], stops: [], lists: [], listItems: [], expenses: [] },
  });
  assert.equal(originDenied.statusCode, 403);
  assert.equal(calls, 1);
});