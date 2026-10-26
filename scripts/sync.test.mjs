import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { PostgresSyncRepository, SyncPayloadError } from '../apps/api/src/sync/postgres-sync-repository.ts';
import { down as downCore, up as upCore } from '../db/migrations/001_create_core_schema.js';
import { down as downSchedule, up as upSchedule } from '../db/migrations/002_add_stop_schedule.js';
import { down as downLocationSource, up as upLocationSource } from '../db/migrations/003_add_stop_location_source.js';
import { down as downSyncVersion, up as upSyncVersion } from '../db/migrations/004_add_trip_sync_version.js';

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

const ownerId = '20000000-0000-4000-8000-000000000001';
const otherOwnerId = '20000000-0000-4000-8000-000000000005';
const tripId = '20000000-0000-4000-8000-000000000002';
const dayId = '20000000-0000-4000-8000-000000000003';
const stopId = '20000000-0000-4000-8000-000000000004';
const listId = '20000000-0000-4000-8000-000000000006';
const itemId = '20000000-0000-4000-8000-000000000007';
const expenseId = '20000000-0000-4000-8000-000000000008';
const timestamp = '2026-10-26T12:00:00.000Z';

function snapshot(title = 'Roma') {
  return {
    expectedVersion: 0,
    trip: {
      id: tripId, title, description: null, startsOn: null, endsOn: null, timeZone: 'Europe/Rome',
      revision: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    },
    days: [{
      id: dayId, tripId, date: '2026-10-26', position: 0,
      revision: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    }],
    stops: [{
      id: stopId, tripId, dayId, name: 'Colosseo', category: 'museum', planningState: 'planned',
      isFavorite: false, visitedAt: null, position: 0, address: null, latitude: 41.8902,
      longitude: 12.4922, scheduledAt: null, durationMinutes: null, locationSource: 'manual',
      sourcePlaceId: null, revision: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    }],
    lists: [{
      id: listId, tripId, title: 'Bagaglio', kind: 'packing',
      revision: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    }],
    listItems: [{
      id: itemId, listId, label: 'Caricatore', checkedAt: null, position: 0,
      revision: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    }],
    expenses: [{
      id: expenseId, tripId, description: 'Treno', amountMinor: 2490, currency: 'EUR',
      spentAt: timestamp, paidByUserId: null,
      revision: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    }],
  };
}

test('sync PostgreSQL applica snapshot atomici, versioni ottimistiche e ownership', async (context) => {
  const engine = new PGlite();
  context.after(() => engine.close());
  await engine.exec(captureSql(upCore));
  await engine.exec(captureSql(upSchedule));
  await engine.exec(captureSql(upLocationSource));
  await engine.exec(captureSql(upSyncVersion));
  await engine.query(
    'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3), ($4, $5, $6)',
    [ownerId, 'owner@example.test', 'hash', otherOwnerId, 'other@example.test', 'hash'],
  );

  const repository = new PostgresSyncRepository(adaptPostgres(engine));
  const initial = await repository.pushTrip(ownerId, snapshot());
  assert.equal(initial.kind, 'saved');
  assert.equal(initial.snapshot.version, 1);
  assert.equal(initial.snapshot.days[0].date, '2026-10-26');
  assert.equal(initial.snapshot.stops[0].locationSource, 'manual');
  assert.equal(initial.snapshot.lists[0].kind, 'packing');
  assert.equal(initial.snapshot.listItems[0].label, 'Caricatore');
  assert.equal(initial.snapshot.expenses[0].amountMinor, 2490);
  assert.equal(await repository.getTrip(otherOwnerId, tripId), null);
  assert.equal((await repository.listTrips(ownerId)).length, 1);
  assert.equal((await repository.listTrips(otherOwnerId)).length, 0);

  const stale = snapshot('Non sovrascrivere');
  const conflict = await repository.pushTrip(ownerId, stale);
  assert.equal(conflict.kind, 'conflict');
  assert.equal(conflict.current.version, 1);
  assert.equal(conflict.current.trip.title, 'Roma');

  const update = snapshot('Roma aggiornata');
  update.expectedVersion = 1;
  update.stops[0].isFavorite = true;
  update.listItems[0].checkedAt = timestamp;
  update.expenses[0].amountMinor = 2590;
  const saved = await repository.pushTrip(ownerId, update);
  assert.equal(saved.kind, 'saved');
  assert.equal(saved.snapshot.version, 2);
  assert.equal(saved.snapshot.trip.title, 'Roma aggiornata');
  assert.equal(saved.snapshot.stops[0].isFavorite, true);
  assert.equal(saved.snapshot.listItems[0].checkedAt, timestamp);
  assert.equal(saved.snapshot.expenses[0].amountMinor, 2590);

  const deletedLogistics = snapshot('Roma aggiornata');
  deletedLogistics.expectedVersion = 2;
  deletedLogistics.lists[0].deletedAt = timestamp;
  deletedLogistics.listItems[0].deletedAt = timestamp;
  deletedLogistics.expenses[0].deletedAt = timestamp;
  const deleted = await repository.pushTrip(ownerId, deletedLogistics);
  assert.equal(deleted.kind, 'saved');
  assert.equal(deleted.snapshot.version, 3);
  assert.notEqual(deleted.snapshot.lists[0].deletedAt, null);
  assert.notEqual(deleted.snapshot.listItems[0].deletedAt, null);
  assert.notEqual(deleted.snapshot.expenses[0].deletedAt, null);

  const invalidRelations = snapshot('Non valido');
  invalidRelations.expectedVersion = 3;
  invalidRelations.stops[0].dayId = '20000000-0000-4000-8000-000000000099';
  await assert.rejects(repository.pushTrip(ownerId, invalidRelations), SyncPayloadError);
  assert.equal((await repository.getTrip(ownerId, tripId)).version, 3);

  const invalidListItem = snapshot('Riferimento lista errato');
  invalidListItem.expectedVersion = 3;
  invalidListItem.listItems[0].listId = '20000000-0000-4000-8000-000000000099';
  await assert.rejects(repository.pushTrip(ownerId, invalidListItem), SyncPayloadError);
  assert.equal((await repository.getTrip(ownerId, tripId)).version, 3);

  await engine.exec(captureSql(downSyncVersion));
  await engine.exec(captureSql(downLocationSource));
  await engine.exec(captureSql(downSchedule));
  await engine.exec(captureSql(downCore));
});