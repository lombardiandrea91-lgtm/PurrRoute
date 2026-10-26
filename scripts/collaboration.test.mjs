import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { PostgresTripCollaborationRepository } from '../apps/api/src/collaboration/postgres-trip-collaboration.ts';
import { PostgresSyncRepository } from '../apps/api/src/sync/postgres-sync-repository.ts';
import { up as upCore } from '../db/migrations/001_create_core_schema.js';
import { up as upSchedule } from '../db/migrations/002_add_stop_schedule.js';
import { up as upLocationSource } from '../db/migrations/003_add_stop_location_source.js';
import { up as upSyncVersion } from '../db/migrations/004_add_trip_sync_version.js';
import { up as upWikidataSource } from '../db/migrations/005_add_wikidata_location_source.js';
import { up as upStopSourceUrl } from '../db/migrations/006_add_stop_source_url.js';

function captureSql(migration) {
  const statements = [];
  migration({ sql: (statement) => statements.push(statement) });
  return statements.join('\n');
}

function adaptPostgres(database) {
  return {
    async query(statement, values = []) {
      const result = await database.query(statement, values);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
    transaction(work) {
      return database.transaction((connection) => work(adaptPostgres(connection)));
    },
  };
}

const ownerId = '50000000-0000-4000-8000-000000000001';
const memberId = '50000000-0000-4000-8000-000000000002';
const unverifiedId = '50000000-0000-4000-8000-000000000003';
const tripId = '50000000-0000-4000-8000-000000000004';

test('collaborazione PostgreSQL richiede account verificati e revoca subito l’accesso', async (context) => {
  const engine = new PGlite();
  context.after(() => engine.close());
  for (const migration of [upCore, upSchedule, upLocationSource, upSyncVersion, upWikidataSource, upStopSourceUrl]) {
    await engine.exec(captureSql(migration));
  }
  await engine.query(
    `INSERT INTO users (id, email, password_hash, email_verified_at)
      VALUES ($1, $2, 'hash', now()), ($3, $4, 'hash', now()), ($5, $6, 'hash', NULL)`,
    [ownerId, 'owner@example.test', memberId, 'member@example.test', unverifiedId, 'pending@example.test'],
  );
  await engine.query(
    `INSERT INTO trips (id, owner_id, title, sync_version) VALUES ($1, $2, 'Roma condivisa', 1)`,
    [tripId, ownerId],
  );

  const database = adaptPostgres(engine);
  const collaboration = new PostgresTripCollaborationRepository(database);
  const sync = new PostgresSyncRepository(database);
  assert.deepEqual(await collaboration.listMembers(ownerId, tripId), [
    { userId: ownerId, email: 'owner@example.test', role: 'owner' },
  ]);
  assert.equal(await collaboration.addMember(ownerId, tripId, 'pending@example.test', 'editor'), null);
  assert.equal(await collaboration.addMember(memberId, tripId, 'owner@example.test', 'editor'), null);

  const added = await collaboration.addMember(ownerId, tripId, 'MEMBER@example.test', 'editor');
  assert.deepEqual(added, { userId: memberId, email: 'member@example.test', role: 'editor' });
  assert.ok(await sync.getTrip(memberId, tripId));
  assert.equal((await sync.listTrips(memberId)).length, 1);

  const changed = await collaboration.addMember(ownerId, tripId, 'member@example.test', 'viewer');
  assert.equal(changed.role, 'viewer');
  assert.equal((await collaboration.listMembers(memberId, tripId)).length, 2);
  assert.equal(await collaboration.removeMember(memberId, tripId, memberId), false);
  assert.equal(await collaboration.removeMember(ownerId, tripId, memberId), true);
  assert.equal(await sync.getTrip(memberId, tripId), null);
  assert.equal((await sync.listTrips(memberId)).length, 0);

  const restored = await collaboration.addMember(ownerId, tripId, 'member@example.test', 'editor');
  assert.equal(restored.userId, memberId);
  assert.equal((await collaboration.listMembers(ownerId, tripId)).length, 2);
});