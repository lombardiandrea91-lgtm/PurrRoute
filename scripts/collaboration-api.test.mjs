import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../apps/api/src/server.ts';

const ownerId = '60000000-0000-4000-8000-000000000001';
const tripId = '60000000-0000-4000-8000-000000000002';
const memberId = '60000000-0000-4000-8000-000000000003';
const owner = { id: ownerId, email: 'owner@example.test', emailVerifiedAt: '2026-10-26T12:00:00.000Z' };
const member = { userId: memberId, email: 'member@example.test', role: 'editor' };

test('API collaborazione limita gestione al proprietario e protegge mutazioni con CSRF/Origin', async (context) => {
  const app = buildServer({
    auth: { authenticate: async (token) => token === 'owner-session' ? { account: owner } : null },
    collaboration: {
      listMembers: async (userId) => userId === ownerId ? [
        { userId: ownerId, email: owner.email, role: 'owner' }, member,
      ] : null,
      addMember: async (userId, requestedTripId, email, role) => userId === ownerId && requestedTripId === tripId
        && email.toLowerCase() === member.email ? { ...member, role } : null,
      removeMember: async (userId, requestedTripId, requestedMemberId) =>
        userId === ownerId && requestedTripId === tripId && requestedMemberId === memberId,
    },
  });
  context.after(() => app.close());

  const unauthenticated = await app.inject({ method: 'GET', url: `/api/collaboration/trips/${tripId}/members` });
  assert.equal(unauthenticated.statusCode, 401);
  const mutationHeaders = async () => {
    const csrf = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
    return {
      cookie: `${String(csrf.headers['set-cookie']).split(';')[0]}; purrroute_session=owner-session`,
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'x-csrf-token': csrf.json().csrfToken,
    };
  };
  const headers = await mutationHeaders();
  const list = await app.inject({ method: 'GET', url: `/api/collaboration/trips/${tripId}/members`, headers });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().members.length, 2);

  const noCsrf = await app.inject({
    method: 'POST', url: `/api/collaboration/trips/${tripId}/members`,
    headers: { ...headers, 'x-csrf-token': '' }, payload: { email: member.email, role: 'editor' },
  });
  assert.equal(noCsrf.statusCode, 403);
  const invalidRole = await app.inject({
    method: 'POST', url: `/api/collaboration/trips/${tripId}/members`, headers,
    payload: { email: member.email, role: 'owner' },
  });
  assert.equal(invalidRole.statusCode, 400);
  const added = await app.inject({
    method: 'POST', url: `/api/collaboration/trips/${tripId}/members`, headers: await mutationHeaders(),
    payload: { email: member.email, role: 'viewer' },
  });
  assert.equal(added.statusCode, 200);
  assert.equal(added.json().role, 'viewer');

  const deleteHeaders = await mutationHeaders();
  delete deleteHeaders['content-type'];
  const deniedOrigin = await app.inject({
    method: 'DELETE', url: `/api/collaboration/trips/${tripId}/members/${memberId}`,
    headers: { ...deleteHeaders, origin: 'https://other.example' },
  });
  assert.equal(deniedOrigin.statusCode, 403);
  const removed = await app.inject({
    method: 'DELETE', url: `/api/collaboration/trips/${tripId}/members/${memberId}`, headers: deleteHeaders,
  });
  assert.equal(removed.statusCode, 200, removed.body);
  assert.deepEqual(removed.json(), { removed: true });
});