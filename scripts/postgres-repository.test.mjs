import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { AuthService, DevelopmentMailSink } from '../apps/api/src/auth/auth-service.ts';
import { PostgresAuthRepository } from '../apps/api/src/auth/postgres-auth-repository.ts';
import { down as downCore, up as upCore } from '../db/migrations/001_create_core_schema.js';
import { down as downSchedule, up as upSchedule } from '../db/migrations/002_add_stop_schedule.js';
import { down as downLocationSource, up as upLocationSource } from '../db/migrations/003_add_stop_location_source.js';

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
    close() {
      return database.close();
    },
  };
}

test('repository PostgreSQL gestisce auth, sessioni, export e cancellazione sullo schema reale', async (context) => {
  const engine = new PGlite();
  context.after(() => engine.close());
  await engine.exec(captureSql(upCore));
  await engine.exec(captureSql(upSchedule));
  await engine.exec(captureSql(upLocationSource));

  const now = () => new Date();
  const repository = new PostgresAuthRepository(adaptPostgres(engine));
  const mailer = new DevelopmentMailSink();
  const service = new AuthService(repository, mailer, now);

  assert.deepEqual(await service.register('ANDREA@example.test', 'initial-password-long'), { accepted: true });
  const verification = mailer.messages()[0];
  const storedToken = await engine.query('SELECT token_hash FROM account_tokens');
  assert.equal(storedToken.rows[0].token_hash.toString('base64url') === verification.token, false);
  assert.equal(await service.verifyEmail(verification.token), true);
  assert.equal(await service.verifyEmail(verification.token), false);

  const account = await repository.findAccountByEmail('andrea@example.test');
  assert.ok(account);
  const tripId = '10000000-0000-4000-8000-000000000001';
  const stopId = '10000000-0000-4000-8000-000000000002';
  await engine.query(
    'INSERT INTO trips (id, owner_id, title) VALUES ($1, $2, $3)',
    [tripId, account.id, 'Roma'],
  );
  await engine.query(
    `INSERT INTO trip_stops
      (id, trip_id, name, category, is_favorite, visited_at, scheduled_at, duration_minutes, location_source, source_place_id)
      VALUES ($1, $2, $3, $4, true, now(), $5, $6, 'locationiq', $7)`,
    [stopId, tripId, 'Colosseo', 'museum', '2026-10-26T09:30:00.000Z', 90, 'place-123'],
  );

  const login = await service.login('andrea@example.test', 'initial-password-long');
  assert.equal('passwordHash' in login.account, false);
  assert.equal((await service.authenticate(login.sessionToken)).account.id, account.id);
  const exported = await service.exportAccount(account.id);
  assert.equal(exported.trips.length, 1);
  assert.equal(exported.stops[0].is_favorite, true);
  assert.equal(exported.stops[0].duration_minutes, 90);
  assert.equal(exported.stops[0].location_source, 'locationiq');
  assert.equal(exported.stops[0].source_place_id, 'place-123');
  assert.equal(exported.stops[0].visited_at instanceof Date || typeof exported.stops[0].visited_at === 'string', true);
  assert.equal('password_hash' in exported.account, false);

  await service.requestPasswordReset('ANDREA@example.test');
  const reset = mailer.messages()[1];
  assert.equal(await service.resetPassword(reset.token, 'replacement-password'), true);
  assert.equal(await service.authenticate(login.sessionToken), null);
  assert.equal(await service.login('andrea@example.test', 'initial-password-long').catch((error) => error.code), 'invalid_credentials');

  const newLogin = await service.login('andrea@example.test', 'replacement-password');
  assert.equal(await service.deleteAccount(account.id, 'replacement-password'), true);
  assert.equal(await service.authenticate(newLogin.sessionToken), null);
  assert.equal((await engine.query('SELECT count(*)::integer AS count FROM trips')).rows[0].count, 0);

  await engine.exec(captureSql(downLocationSource));
  await engine.exec(captureSql(downSchedule));
  await engine.exec(captureSql(downCore));
});