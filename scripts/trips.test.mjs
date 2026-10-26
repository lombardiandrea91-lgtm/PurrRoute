import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

await import('fake-indexeddb/auto');
const Dexie = (await import('dexie')).default;
const { createTripDatabase, PurrRouteLocalDatabase } = await import('../apps/web/src/trips/database.ts');
const { LocalTripRepository, TripValidationError } = await import('../apps/web/src/trips/repository.ts');

async function withRepository(work) {
  const database = createTripDatabase(`purrroute-test-${randomUUID()}`);
  try {
    await work(new LocalTripRepository(database), database);
  } finally {
    await database.delete();
  }
}

test('upgrade IndexedDB v3 aggiunge sourceUrl nullo senza perdere le tappe', async () => {
  const name = `purrroute-legacy-${randomUUID()}`;
  const legacy = new Dexie(name);
  legacy.version(3).stores({
    trips: 'id, ownerId, updatedAt, deletedAt',
    days: 'id, tripId, date, position, updatedAt, deletedAt',
    stops: 'id, tripId, dayId, category, planningState, position, isFavorite, visitedAt, updatedAt, deletedAt',
    lists: 'id, tripId, kind, updatedAt, deletedAt',
    listItems: 'id, listId, position, updatedAt, deletedAt',
    expenses: 'id, tripId, spentAt, currency, updatedAt, deletedAt',
    metadata: 'id',
    syncStates: 'id, accountId, serverVersion',
  });
  await legacy.open();
  await legacy.table('stops').put({
    id: 'legacy-stop', tripId: 'legacy-trip', dayId: null, name: 'Tappa esistente', category: 'attraction',
    planningState: 'planned', isFavorite: false, visitedAt: null, position: 0, address: null,
    latitude: null, longitude: null, scheduledAt: null, durationMinutes: null,
    locationSource: null, sourcePlaceId: null, revision: 1,
    createdAt: '2026-10-26T12:00:00.000Z', updatedAt: '2026-10-26T12:00:00.000Z', deletedAt: null,
  });
  legacy.close();

  const upgraded = new PurrRouteLocalDatabase(name);
  try {
    await upgraded.open();
    const stop = await upgraded.stops.get('legacy-stop');
    assert.equal(stop.name, 'Tappa esistente');
    assert.equal(stop.sourceUrl, null);
  } finally {
    await upgraded.delete();
  }
});

test('viaggio e giorni sono persistiti con input normalizzati e date uniche', async () => {
  await withRepository(async (repository, database) => {
    const trip = await repository.createTrip({ title: '  Roma  ', startsOn: '2026-10-26', endsOn: '2026-10-28' });
    assert.equal(trip.title, 'Roma');
    assert.equal(trip.ownerId, (await repository.createTrip({ title: 'Milano' })).ownerId);
    assert.equal((await repository.listTrips()).length, 2);

    const day = await repository.createDay(trip.id, { date: '2026-10-26' });
    assert.equal(day.position, 0);
    assert.equal((await repository.getTrip(trip.id)).trip.revision, trip.revision + 1);
    await assert.rejects(repository.createDay(trip.id, { date: '2026-10-26' }),
      (error) => error instanceof TripValidationError && error.code === 'duplicate_day');
    await assert.rejects(repository.createTrip({ title: 'Invalid', startsOn: '2026-10-28', endsOn: '2026-10-26' }),
      (error) => error instanceof TripValidationError && error.code === 'invalid_date_range');
    await assert.rejects(repository.createTrip({ title: 'Invalid', startsOn: '2026-02-31' }),
      (error) => error instanceof TripValidationError && error.code === 'invalid_date');
    await assert.rejects(repository.createDay(trip.id, { date: '2026-02-31' }),
      (error) => error instanceof TripValidationError && error.code === 'invalid_date');

    const freshRepository = new LocalTripRepository(database);
    assert.equal((await freshRepository.getTrip(trip.id)).days[0].id, day.id);
    const otherTrip = await repository.createTrip({ title: 'Milano' });
    const otherDay = await repository.createDay(otherTrip.id, { date: '2026-10-26' });
    await assert.rejects(repository.createStop(trip.id, {
      name: 'Cross-trip', category: 'waypoint', dayId: otherDay.id,
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_day');
  });
});

test('tappe hanno orario, preferito e visitato indipendenti e si riordinano tra giorni', async () => {
  await withRepository(async (repository) => {
    const trip = await repository.createTrip({ title: 'Firenze' });
    const firstDay = await repository.createDay(trip.id, { date: '2026-11-01' });
    const secondDay = await repository.createDay(trip.id, { date: '2026-11-02' });
    const firstStop = await repository.createStop(trip.id, {
      name: 'Uffizi', category: 'museum', dayId: firstDay.id,
      scheduledAt: '2026-11-01T09:30:00.000Z', durationMinutes: 90,
    });
    const secondStop = await repository.createStop(trip.id, {
      name: 'Duomo', category: 'attraction', dayId: firstDay.id,
    });
    await repository.updateStop(firstStop.id, {
      isFavorite: true,
      visitedAt: '2026-11-01T11:00:00.000Z',
    });
    await repository.moveStop(trip.id, secondStop.id, secondDay.id, 0);
    const thirdStop = await repository.createStop(trip.id, {
      name: 'Ponte Vecchio', category: 'attraction', dayId: firstDay.id,
    });
    await repository.moveStop(trip.id, thirdStop.id, firstDay.id, 0);

    const details = await repository.getTrip(trip.id);
    const favorite = details.stops.find((stop) => stop.id === firstStop.id);
    const moved = details.stops.find((stop) => stop.id === secondStop.id);
    const reordered = details.stops.find((stop) => stop.id === thirdStop.id);
    assert.equal(favorite.isFavorite, true);
    assert.equal(favorite.visitedAt, '2026-11-01T11:00:00.000Z');
    assert.equal(favorite.scheduledAt, '2026-11-01T09:30:00.000Z');
    assert.equal(favorite.durationMinutes, 90);
    assert.equal(moved.dayId, secondDay.id);
    assert.equal(moved.position, 0);
    assert.equal(reordered.position, 0);
    assert.equal(favorite.position, 1);
  });
});

test('eliminare un giorno disassegna le tappe; eliminare il viaggio conserva tombstone', async () => {
  await withRepository(async (repository, database) => {
    const trip = await repository.createTrip({ title: 'Napoli' });
    const day = await repository.createDay(trip.id, { date: '2026-12-05' });
    const stop = await repository.createStop(trip.id, { name: 'Museo', category: 'museum', dayId: day.id });

    await repository.deleteDay(trip.id, day.id);
    assert.equal((await repository.getTrip(trip.id)).stops[0].dayId, null);
    await repository.deleteStop(trip.id, stop.id);
    assert.equal((await repository.getTrip(trip.id)).stops.length, 0);
    assert.notEqual((await database.stops.get(stop.id)).deletedAt, null);

    await repository.deleteTrip(trip.id);
    assert.equal(await repository.getTrip(trip.id), null);
    assert.equal((await repository.listTrips()).some((item) => item.id === trip.id), false);
    assert.equal((await database.stops.get(stop.id)).deletedAt === null, false);
  });
});

test('coordinate tappa sono opzionali ma sempre una coppia valida', async () => {
  await withRepository(async (repository) => {
    const trip = await repository.createTrip({ title: 'Venezia' });
    const located = await repository.createStop(trip.id, {
      name: 'Piazza San Marco', category: 'attraction',
      address: 'Piazza San Marco, Venezia', latitude: 45.4342, longitude: 12.3388,
    });
    assert.equal(located.locationSource, 'manual');
    assert.equal(located.sourcePlaceId, null);
    assert.equal(located.latitude, 45.4342);
    assert.equal(located.longitude, 12.3388);
    assert.equal(located.address, 'Piazza San Marco, Venezia');
    const moved = await repository.updateStop(located.id, { latitude: 45.4343, longitude: 12.3389 });
    assert.equal(moved.latitude, 45.4343);
    assert.equal(moved.longitude, 12.3389);

    await assert.rejects(repository.createStop(trip.id, {
      name: 'Latitudine sola', category: 'waypoint', latitude: 45,
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_stop');
    await assert.rejects(repository.createStop(trip.id, {
      name: 'Latitudine fuori range', category: 'waypoint', latitude: 91, longitude: 12,
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_stop');
    await assert.rejects(repository.createStop(trip.id, {
      name: 'Fonte senza ID', category: 'waypoint', latitude: 45, longitude: 12,
      locationSource: 'locationiq',
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_stop');
    const sourced = await repository.createStop(trip.id, {
      name: 'Duomo', category: 'museum', latitude: 45.46, longitude: 9.19,
      locationSource: 'locationiq', sourcePlaceId: 'place-123',
      sourceUrl: 'https://example.test/duomo',
    });
    assert.equal(sourced.sourcePlaceId, 'place-123');
    assert.equal(sourced.sourceUrl, 'https://example.test/duomo');
    await assert.rejects(repository.createStop(trip.id, {
      name: 'Link non HTTPS', category: 'attraction', sourceUrl: 'http://example.test/place',
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_stop');
    const wikidata = await repository.createStop(trip.id, {
      name: 'Museo Wikidata', category: 'museum', latitude: 45.46, longitude: 9.19,
      locationSource: 'wikidata', sourcePlaceId: 'Q123456',
    });
    assert.equal(wikidata.locationSource, 'wikidata');
    assert.equal(wikidata.sourcePlaceId, 'Q123456');
    await assert.rejects(repository.createStop(trip.id, {
      name: 'Fonte senza QID', category: 'museum', latitude: 45.46, longitude: 9.19,
      locationSource: 'wikidata',
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_stop');
    const manuallyRepositioned = await repository.updateStop(sourced.id, {
      latitude: 45.47, longitude: 9.2, locationSource: 'manual', sourcePlaceId: null,
    });
    assert.equal(manuallyRepositioned.locationSource, 'manual');
    assert.equal(manuallyRepositioned.sourcePlaceId, null);
  });
});

test('sync locale rileva modifiche, conserva owner ospite e applica lo snapshot scelto', async () => {
  await withRepository(async (repository) => {
    const trip = await repository.createTrip({ title: 'Bologna' });
    const day = await repository.createDay(trip.id, { date: '2026-10-27' });
    await repository.createStop(trip.id, { name: 'Due Torri', category: 'attraction', dayId: day.id });
    const accountId = '40000000-0000-4000-8000-000000000001';
    const details = await repository.getTrip(trip.id);
    const { ownerId, ...tripForSync } = details.trip;
    assert.ok(ownerId);
    assert.deepEqual((await repository.listSyncCandidates(accountId)).map((item) => item.id), [trip.id]);

    await repository.markTripSynced(trip.id, accountId, 1, details.trip.revision, '2026-10-26T12:00:00.000Z');
    assert.deepEqual(await repository.listSyncCandidates(accountId), []);
    await repository.updateStop(details.stops[0].id, { isFavorite: true });
    assert.deepEqual((await repository.listSyncCandidates(accountId)).map((item) => item.id), [trip.id]);

    await repository.deleteStop(trip.id, details.stops[0].id);
    assert.equal((await repository.getTrip(trip.id)).stops.length, 0);
    assert.notEqual((await repository.getTripForSync(trip.id)).stops[0].deletedAt, null);

    const remote = await repository.getTripForSync(trip.id);
    const { ownerId: _ownerId, ...remoteTrip } = remote.trip;
    await repository.replaceTripFromSync({
      version: 2,
      trip: { ...remoteTrip, title: 'Bologna dal cloud', revision: remoteTrip.revision + 1 },
      days: remote.days,
      stops: [{ ...remote.stops[0], name: 'Piazza Maggiore' }],
      lists: remote.lists,
      listItems: remote.listItems,
      expenses: remote.expenses,
      syncedAt: '2026-10-26T12:05:00.000Z',
    }, accountId);

    const replaced = await repository.getTripForSync(trip.id);
    assert.equal(replaced.trip.title, 'Bologna dal cloud');
    assert.equal(replaced.stops[0].name, 'Piazza Maggiore');
    assert.equal(replaced.trip.ownerId, ownerId);
    assert.equal((await repository.getSyncState(trip.id)).serverVersion, 2);
    assert.deepEqual(await repository.listSyncCandidates(accountId), []);
    assert.deepEqual(
      (await repository.listSyncCandidates('40000000-0000-4000-8000-000000000002')).map((item) => item.id),
      [trip.id],
    );
  });
});

test('logistica locale gestisce liste, voci e spese senza mischiare valute', async () => {
  await withRepository(async (repository) => {
    const trip = await repository.createTrip({ title: 'Torino' });
    const packing = await repository.createTripList(trip.id, { title: 'Bagaglio', kind: 'packing' });
    const checklist = await repository.createTripList(trip.id, { title: 'Prima di partire', kind: 'checklist' });
    const charger = await repository.createTripListItem(packing.id, 'Caricatore');
    const passport = await repository.createTripListItem(packing.id, 'Documento');
    const checkedCharger = await repository.updateTripListItem(charger.id, { checkedAt: '2026-10-26T12:00:00.000Z' });
    assert.equal(checkedCharger.checkedAt, '2026-10-26T12:00:00.000Z');
    await repository.updateTripList(packing.id, 'Valigia');
    await repository.createTripListItem(checklist.id, 'Check-in');

    const euro = await repository.createTripExpense(trip.id, {
      description: 'Treno', amountMinor: 12450, currency: 'eur', spentAt: '2026-10-26T12:00:00.000Z',
    });
    const yen = await repository.createTripExpense(trip.id, {
      description: 'Metro', amountMinor: 1800, currency: 'JPY',
    });
    const updatedEuro = await repository.updateTripExpense(euro.id, { amountMinor: 12700, currency: 'chf' });
    assert.equal(updatedEuro.amountMinor, 12700);
    assert.equal(updatedEuro.currency, 'CHF');
    assert.equal(euro.currency, 'EUR');
    assert.equal(euro.amountMinor, 12450);
    await assert.rejects(repository.createTripExpense(trip.id, {
      description: 'Invalid', amountMinor: 1.5, currency: 'EUR',
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_expense');
    await assert.rejects(repository.createTripExpense(trip.id, {
      description: 'Invalid', amountMinor: 100, currency: 'EURO',
    }), (error) => error instanceof TripValidationError && error.code === 'invalid_expense');

    const details = await repository.getTrip(trip.id);
    assert.equal(details.lists.length, 2);
    assert.equal(details.listItems.find((item) => item.id === charger.id).checkedAt, '2026-10-26T12:00:00.000Z');
    assert.deepEqual(new Set(details.expenses.map((expense) => expense.currency)), new Set(['CHF', 'JPY']));

    await repository.deleteTripList(packing.id);
    await repository.deleteTripExpense(yen.id);
    await repository.deleteTripListItem((await repository.getTrip(trip.id)).listItems
      .find((item) => item.listId === checklist.id).id);
    const active = await repository.getTrip(trip.id);
    assert.equal(active.lists.some((list) => list.id === packing.id), false);
    assert.equal(active.listItems.some((item) => item.id === passport.id), false);
    assert.equal(active.expenses.some((expense) => expense.id === yen.id), false);
    const full = await repository.getTripForSync(trip.id);
    assert.notEqual(full.lists.find((list) => list.id === packing.id).deletedAt, null);
    assert.notEqual(full.listItems.find((item) => item.id === passport.id).deletedAt, null);
    assert.notEqual(full.expenses.find((expense) => expense.id === yen.id).deletedAt, null);
    assert.equal(full.expenses.find((expense) => expense.id === euro.id).currency, 'CHF');

    await repository.deleteTrip(trip.id);
    const deletedTrip = await repository.getTripForSync(trip.id);
    assert.notEqual(deletedTrip.trip.deletedAt, null);
    assert.ok(deletedTrip.lists.every((list) => list.deletedAt !== null));
    assert.ok(deletedTrip.listItems.every((item) => item.deletedAt !== null));
    assert.ok(deletedTrip.expenses.every((expense) => expense.deletedAt !== null));
  });
});