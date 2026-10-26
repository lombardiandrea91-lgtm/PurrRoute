import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { down as downCore, up as upCore } from '../db/migrations/001_create_core_schema.js';
import { down as downSchedule, up as upSchedule } from '../db/migrations/002_add_stop_schedule.js';
import { down as downLocationSource, up as upLocationSource } from '../db/migrations/003_add_stop_location_source.js';

function captureSql(migration) {
  const statements = [];
  migration({ sql: (statement) => statements.push(statement) });
  return statements.join('\n');
}

test('la migrazione definisce account, sessioni e tutte le entita viaggio richieste', () => {
  const sql = captureSql(upCore);

  for (const table of [
    'users', 'user_sessions', 'account_tokens', 'trips', 'trip_memberships', 'trip_days',
    'trip_stops', 'trip_notes', 'trip_lists', 'trip_list_items', 'trip_expenses', 'trip_documents',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table} \\(`));
  }
});

test('la migrazione vincola categorie, piano tappa, ownership relazionale e token opachi', () => {
  const sql = captureSql(upCore);

  assert.match(sql, /'departure'.*'shopping'/s);
  assert.match(sql, /planning_state IN \('planned', 'optional'\)/);
  assert.match(sql, /is_favorite boolean NOT NULL DEFAULT false/);
  assert.match(sql, /visited_at timestamptz/);
  assert.match(sql, /FOREIGN KEY \(trip_id, day_id\) REFERENCES trip_days\(trip_id, id\)/);
  assert.match(sql, /session_hash bytea PRIMARY KEY CHECK \(octet_length\(session_hash\) = 32\)/);
  assert.match(sql, /token_hash bytea PRIMARY KEY CHECK \(octet_length\(token_hash\) = 32\)/);
});

test('il rollback rimuove le tabelle in ordine dipendenze inverso', () => {
  const sql = captureSql(downCore);

  assert.ok(sql.indexOf('DROP TABLE IF EXISTS trip_documents') < sql.indexOf('DROP TABLE IF EXISTS trips'));
  assert.ok(sql.indexOf('DROP TABLE IF EXISTS trips') < sql.indexOf('DROP TABLE IF EXISTS users'));
});

test('PostgreSQL applica la migrazione e fa rispettare vincoli e rollback', async (context) => {
  const database = new PGlite();
  context.after(() => database.close());

  await database.exec(captureSql(upCore));
  await database.exec(captureSql(upSchedule));
  await database.exec(captureSql(upLocationSource));
  const ownerId = '00000000-0000-4000-8000-000000000001';
  const otherTripId = '00000000-0000-4000-8000-000000000002';
  const tripId = '00000000-0000-4000-8000-000000000003';
  const dayId = '00000000-0000-4000-8000-000000000004';

  await database.query(
    'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
    [ownerId, 'owner@example.test', 'test-hash'],
  );
  await database.query(
    'INSERT INTO trips (id, owner_id, title) VALUES ($1, $2, $3), ($4, $2, $5)',
    [tripId, ownerId, 'Roma', otherTripId, 'Milano'],
  );
  await database.query(
    'INSERT INTO trip_days (id, trip_id, day_date, position) VALUES ($1, $2, $3, 0)',
    [dayId, tripId, '2026-10-26'],
  );
  await database.query(
    `INSERT INTO trip_stops
      (id, trip_id, day_id, name, category, is_favorite, visited_at, scheduled_at, duration_minutes)
      VALUES ($1, $2, $3, $4, $5, true, now(), $6, $7)`,
    ['00000000-0000-4000-8000-000000000005', tripId, dayId, 'Colosseo', 'museum', '2026-10-26T09:30:00.000Z', 90],
  );

  const markers = await database.query(
    'SELECT is_favorite, visited_at IS NOT NULL AS visited, scheduled_at, duration_minutes FROM trip_stops WHERE name = $1',
    ['Colosseo'],
  );
  assert.equal(markers.rows[0].is_favorite, true);
  assert.equal(markers.rows[0].visited, true);
  assert.equal(markers.rows[0].duration_minutes, 90);

  await assert.rejects(database.query(
    `INSERT INTO trip_stops (id, trip_id, day_id, name, category)
      VALUES ($1, $2, $3, $4, $5)`,
    ['00000000-0000-4000-8000-000000000006', tripId, dayId, 'Luogo', 'unknown'],
  ));
  await assert.rejects(database.query(
    `INSERT INTO trip_stops (id, trip_id, day_id, name, category)
      VALUES ($1, $2, $3, $4, $5)`,
    ['00000000-0000-4000-8000-000000000007', otherTripId, dayId, 'Riferimento errato', 'waypoint'],
  ));
  await assert.rejects(database.query(
    `INSERT INTO trip_stops
      (id, trip_id, day_id, name, category, location_source)
      VALUES ($1, $2, $3, $4, $5, 'locationiq')`,
    ['00000000-0000-4000-8000-000000000008', tripId, dayId, 'Fonte senza ID', 'waypoint'],
  ));

  await database.exec(captureSql(downLocationSource));
  await database.exec(captureSql(downSchedule));
  await database.exec(captureSql(downCore));
  const remainingTables = await database.query(
    `SELECT count(*)::integer AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'trips', 'trip_days', 'trip_stops')`,
  );
  assert.equal(remainingTables.rows[0].count, 0);
});