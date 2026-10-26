import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

await import('fake-indexeddb/auto');
const { createTripDatabase } = await import('../apps/web/src/trips/database.ts');
const { LocalTripRepository, TripValidationError } = await import('../apps/web/src/trips/repository.ts');

async function withRepository(work) {
  const database = createTripDatabase(`purrroute-test-${randomUUID()}`);
  try {
    await work(new LocalTripRepository(database), database);
  } finally {
    await database.delete();
  }
}

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
    });
    assert.equal(sourced.sourcePlaceId, 'place-123');
    const manuallyRepositioned = await repository.updateStop(sourced.id, {
      latitude: 45.47, longitude: 9.2, locationSource: 'manual', sourcePlaceId: null,
    });
    assert.equal(manuallyRepositioned.locationSource, 'manual');
    assert.equal(manuallyRepositioned.sourcePlaceId, null);
  });
});