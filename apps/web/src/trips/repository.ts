import { liveQuery } from 'dexie';
import type { StopCategory, StopLocationSource, StopPlanningState, Trip, TripDay, TripStop } from '@purrroute/domain';
import { createStopMarkers } from '@purrroute/domain';
import { tripDatabase } from './database.ts';
import type { PurrRouteLocalDatabase } from './database.ts';

const ownerKey = 'localOwnerId';
const categorySet = new Set<string>([
  'departure', 'destination', 'waypoint', 'lodging', 'restaurant', 'cafe', 'attraction',
  'museum', 'train', 'flight', 'car', 'nature', 'beach', 'shopping',
]);

export interface TripInput {
  title: string;
  description?: string;
  startsOn?: string | null;
  endsOn?: string | null;
  timeZone?: string | null;
}

export interface DayInput {
  date: string;
}

export interface StopInput {
  name: string;
  category: StopCategory;
  planningState?: StopPlanningState;
  dayId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: StopLocationSource | null;
  sourcePlaceId?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
}

export interface TripDetails {
  trip: Trip;
  days: TripDay[];
  stops: TripStop[];
}

export class TripValidationError extends Error {
  readonly code: 'title_required' | 'invalid_date_range' | 'invalid_date' | 'duplicate_day' | 'invalid_trip' | 'invalid_day' | 'invalid_stop';

  constructor(code: TripValidationError['code']) {
    super(code);
    this.code = code;
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function validateTripInput(input: TripInput): Pick<Trip, 'title' | 'description' | 'startsOn' | 'endsOn' | 'timeZone'> {
  const title = input.title.trim();
  if (!title || title.length > 160) throw new TripValidationError('title_required');
  const startsOn = input.startsOn?.trim() || null;
  const endsOn = input.endsOn?.trim() || null;
  if (startsOn) validateDate(startsOn);
  if (endsOn) validateDate(endsOn);
  if (startsOn && endsOn && endsOn < startsOn) throw new TripValidationError('invalid_date_range');
  return {
    title,
    description: input.description?.trim() || null,
    startsOn,
    endsOn,
    timeZone: input.timeZone?.trim() || null,
  };
}

function validateDate(date: string): void {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date) {
    throw new TripValidationError('invalid_date');
  }
}

async function getLocalOwnerId(database: PurrRouteLocalDatabase): Promise<string> {
  return database.transaction('rw', database.metadata, async () => {
    const current = await database.metadata.get(ownerKey);
    if (current) return current.value;
    const id = crypto.randomUUID();
    await database.metadata.put({ id: ownerKey, value: id });
    return id;
  });
}

async function touchTrip(database: PurrRouteLocalDatabase, tripId: string): Promise<void> {
  const trip = await database.trips.get(tripId);
  if (!trip || trip.deletedAt !== null) return;
  await database.trips.put({
    ...trip,
    updatedAt: timestamp(),
    revision: trip.revision + 1,
  });
}

function active<T extends { deletedAt: string | null }>(records: T[]): T[] {
  return records.filter((record) => record.deletedAt === null);
}

export class LocalTripRepository {
  private readonly database: PurrRouteLocalDatabase;

  constructor(database: PurrRouteLocalDatabase = tripDatabase) {
    this.database = database;
  }

  async listTrips(): Promise<Trip[]> {
    return active(await this.database.trips.toArray()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt));
  }

  async getTrip(id: string): Promise<TripDetails | null> {
    return this.database.transaction('r', this.database.trips, this.database.days, this.database.stops, async () => {
      const trip = await this.database.trips.get(id);
      if (!trip || trip.deletedAt !== null) return null;
      const [days, stops] = await Promise.all([
        this.database.days.where('tripId').equals(id).toArray(),
        this.database.stops.where('tripId').equals(id).toArray(),
      ]);
      return {
        trip,
        days: active(days).sort((left, right) => left.date.localeCompare(right.date) || left.position - right.position),
        stops: active(stops).sort((left, right) => left.position - right.position || left.name.localeCompare(right.name)),
      };
    });
  }

  observeTrips(onValue: (trips: Trip[]) => void, onError: (error: unknown) => void): () => void {
    const subscription = liveQuery(() => this.listTrips()).subscribe({ next: onValue, error: onError });
    return () => subscription.unsubscribe();
  }

  observeTrip(id: string, onValue: (details: TripDetails | null) => void, onError: (error: unknown) => void): () => void {
    const subscription = liveQuery(() => this.getTrip(id)).subscribe({ next: onValue, error: onError });
    return () => subscription.unsubscribe();
  }

  async createTrip(input: TripInput): Promise<Trip> {
    const fields = validateTripInput(input);
    const ownerId = await getLocalOwnerId(this.database);
    const now = timestamp();
    const trip: Trip = {
      id: crypto.randomUUID(), ownerId, ...fields,
      revision: 1, createdAt: now, updatedAt: now, deletedAt: null,
    };
    await this.database.trips.add(trip);
    return trip;
  }

  async updateTrip(id: string, input: TripInput): Promise<Trip> {
    const fields = validateTripInput(input);
    return this.database.transaction('rw', this.database.trips, async () => {
      const trip = await this.database.trips.get(id);
      if (!trip || trip.deletedAt !== null) throw new TripValidationError('invalid_trip');
      const updated: Trip = { ...trip, ...fields, revision: trip.revision + 1, updatedAt: timestamp() };
      await this.database.trips.put(updated);
      return updated;
    });
  }

  async deleteTrip(id: string): Promise<void> {
    await this.database.transaction('rw', this.database.trips, this.database.days, this.database.stops, async () => {
      const trip = await this.database.trips.get(id);
      if (!trip || trip.deletedAt !== null) return;
      const now = timestamp();
      await this.database.trips.put({ ...trip, deletedAt: now, updatedAt: now, revision: trip.revision + 1 });
      const [days, stops] = await Promise.all([
        this.database.days.where('tripId').equals(id).toArray(),
        this.database.stops.where('tripId').equals(id).toArray(),
      ]);
      await this.database.days.bulkPut(days.map((day) => day.deletedAt === null
        ? { ...day, deletedAt: now, updatedAt: now, revision: day.revision + 1 }
        : day));
      await this.database.stops.bulkPut(stops.map((stop) => stop.deletedAt === null
        ? { ...stop, deletedAt: now, updatedAt: now, revision: stop.revision + 1 }
        : stop));
    });
  }

  async createDay(tripId: string, input: DayInput): Promise<TripDay> {
    validateDate(input.date);
    return this.database.transaction('rw', this.database.trips, this.database.days, async () => {
      const trip = await this.database.trips.get(tripId);
      if (!trip || trip.deletedAt !== null) throw new TripValidationError('invalid_day');
      const days = active(await this.database.days.where('tripId').equals(tripId).toArray());
      if (days.some((day) => day.date === input.date)) throw new TripValidationError('duplicate_day');
      const now = timestamp();
      const day: TripDay = {
        id: crypto.randomUUID(), tripId, date: input.date, position: days.length,
        revision: 1, createdAt: now, updatedAt: now, deletedAt: null,
      };
      await this.database.days.add(day);
      await touchTrip(this.database, tripId);
      return day;
    });
  }

  async deleteDay(tripId: string, dayId: string): Promise<void> {
    await this.database.transaction('rw', this.database.trips, this.database.days, this.database.stops, async () => {
      const day = await this.database.days.get(dayId);
      if (!day || day.tripId !== tripId || day.deletedAt !== null) return;
      const now = timestamp();
      await this.database.days.put({ ...day, deletedAt: now, updatedAt: now, revision: day.revision + 1 });
      const stops = active(await this.database.stops.where('tripId').equals(tripId).toArray())
        .filter((stop) => stop.dayId === dayId);
      const unassigned = active(await this.database.stops.where('tripId').equals(tripId).toArray())
        .filter((stop) => stop.dayId === null);
      await this.database.stops.bulkPut([...stops, ...unassigned].map((stop, index) => ({
        ...stop, dayId: null, position: index, updatedAt: now, revision: stop.revision + 1,
      })));
      await touchTrip(this.database, tripId);
    });
  }

  async createStop(tripId: string, input: StopInput): Promise<TripStop> {
    const name = input.name.trim();
    if (!name || name.length > 200 || !categorySet.has(input.category)) {
      throw new TripValidationError('invalid_stop');
    }
    if (input.planningState && input.planningState !== 'planned' && input.planningState !== 'optional') {
      throw new TripValidationError('invalid_stop');
    }
    if (input.durationMinutes !== undefined && input.durationMinutes !== null
      && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 0)) {
      throw new TripValidationError('invalid_stop');
    }
    const latitude = input.latitude ?? null;
    const longitude = input.longitude ?? null;
    const locationSource = input.locationSource ?? (latitude !== null ? 'manual' : null);
    const sourcePlaceId = input.sourcePlaceId?.trim() || null;
    if ((latitude === null) !== (longitude === null)
      || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
      || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
      || (locationSource === 'locationiq' && (!sourcePlaceId || latitude === null))
      || (locationSource !== 'locationiq' && sourcePlaceId !== null)) {
      throw new TripValidationError('invalid_stop');
    }
    return this.database.transaction('rw', this.database.trips, this.database.days, this.database.stops, async () => {
      const trip = await this.database.trips.get(tripId);
      if (!trip || trip.deletedAt !== null) throw new TripValidationError('invalid_stop');
      if (input.dayId) {
        const day = await this.database.days.get(input.dayId);
        if (!day || day.tripId !== tripId || day.deletedAt !== null) throw new TripValidationError('invalid_day');
      }
      if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) throw new TripValidationError('invalid_stop');
      const now = timestamp();
      const stops = active(await this.database.stops.where('tripId').equals(tripId).toArray())
        .filter((stop) => stop.dayId === (input.dayId ?? null));
      const stop: TripStop = {
        id: crypto.randomUUID(), tripId, dayId: input.dayId ?? null, name,
        category: input.category, planningState: input.planningState ?? 'planned',
        ...createStopMarkers(), position: stops.length, address: input.address?.trim() || null, latitude, longitude,
        scheduledAt: input.scheduledAt ?? null, durationMinutes: input.durationMinutes ?? null,
        locationSource, sourcePlaceId,
        revision: 1, createdAt: now, updatedAt: now, deletedAt: null,
      };
      await this.database.stops.add(stop);
      await touchTrip(this.database, tripId);
      return stop;
    });
  }

  async updateStop(id: string, changes: Partial<Pick<TripStop,
    'name' | 'category' | 'planningState' | 'isFavorite' | 'visitedAt' | 'scheduledAt'
    | 'durationMinutes' | 'address' | 'latitude' | 'longitude' | 'locationSource' | 'sourcePlaceId'>>): Promise<TripStop> {
    return this.database.transaction('rw', this.database.trips, this.database.stops, async () => {
      const stop = await this.database.stops.get(id);
      if (!stop || stop.deletedAt !== null) throw new TripValidationError('invalid_stop');
      const name = changes.name === undefined ? stop.name : changes.name.trim();
      if (!name || name.length > 200) throw new TripValidationError('invalid_stop');
      if (changes.category !== undefined && !categorySet.has(changes.category)) throw new TripValidationError('invalid_stop');
      if (changes.durationMinutes !== undefined && changes.durationMinutes !== null
        && (!Number.isInteger(changes.durationMinutes) || changes.durationMinutes < 0)) {
        throw new TripValidationError('invalid_stop');
      }
      if (changes.planningState !== undefined
        && changes.planningState !== 'planned' && changes.planningState !== 'optional') {
        throw new TripValidationError('invalid_stop');
      }
      if (changes.scheduledAt && Number.isNaN(Date.parse(changes.scheduledAt))) {
        throw new TripValidationError('invalid_stop');
      }
      const latitude = changes.latitude === undefined ? stop.latitude : changes.latitude;
      const longitude = changes.longitude === undefined ? stop.longitude : changes.longitude;
      const locationSource = changes.locationSource === undefined ? stop.locationSource : changes.locationSource;
      const sourcePlaceId = changes.sourcePlaceId === undefined ? stop.sourcePlaceId : changes.sourcePlaceId;
      if ((latitude === null) !== (longitude === null)
        || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
        || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
        || (locationSource === 'locationiq' && (!sourcePlaceId || latitude === null))
        || (locationSource !== 'locationiq' && sourcePlaceId !== null)) {
        throw new TripValidationError('invalid_stop');
      }
      const updated: TripStop = {
        ...stop, ...changes, name, revision: stop.revision + 1, updatedAt: timestamp(),
      };
      await this.database.stops.put(updated);
      await touchTrip(this.database, stop.tripId);
      return updated;
    });
  }

  async moveStop(tripId: string, stopId: string, destinationDayId: string | null, destinationIndex: number): Promise<void> {
    await this.database.transaction('rw', this.database.trips, this.database.days, this.database.stops, async () => {
      const [days, allStops] = await Promise.all([
        this.database.days.where('tripId').equals(tripId).toArray(),
        this.database.stops.where('tripId').equals(tripId).toArray(),
      ]);
      const stop = allStops.find((item) => item.id === stopId && item.deletedAt === null);
      if (!stop) throw new TripValidationError('invalid_stop');
      if (destinationDayId && !days.some((day) => day.id === destinationDayId && day.deletedAt === null)) {
        throw new TripValidationError('invalid_day');
      }
      const source = active(allStops).filter((item) => item.dayId === stop.dayId && item.id !== stop.id)
        .sort((left, right) => left.position - right.position);
      const destination = stop.dayId === destinationDayId
        ? source
        : active(allStops).filter((item) => item.dayId === destinationDayId && item.id !== stop.id)
          .sort((left, right) => left.position - right.position);
      const index = Math.max(0, Math.min(destinationIndex, destination.length));
      destination.splice(index, 0, stop);
      const now = timestamp();
      const updates: TripStop[] = [];
      const reindex = (items: TripStop[], dayId: string | null) => {
        items.forEach((item, position) => {
          if (item.position !== position || item.dayId !== dayId) {
            updates.push({ ...item, dayId, position, revision: item.revision + 1, updatedAt: now });
          }
        });
      };
      if (stop.dayId === destinationDayId) reindex(destination, destinationDayId);
      else {
        reindex(source, stop.dayId);
        reindex(destination, destinationDayId);
      }
      await this.database.stops.bulkPut(updates);
      await touchTrip(this.database, tripId);
    });
  }

  async deleteStop(tripId: string, stopId: string): Promise<void> {
    await this.database.transaction('rw', this.database.trips, this.database.stops, async () => {
      const stop = await this.database.stops.get(stopId);
      if (!stop || stop.tripId !== tripId || stop.deletedAt !== null) return;
      const now = timestamp();
      await this.database.stops.put({
        ...stop, deletedAt: now, updatedAt: now, revision: stop.revision + 1,
      });
      const siblings = active(await this.database.stops.where('tripId').equals(tripId).toArray())
        .filter((item) => item.dayId === stop.dayId && item.id !== stop.id)
        .sort((left, right) => left.position - right.position);
      await this.database.stops.bulkPut(siblings.flatMap((item, position) => item.position === position
        ? []
        : [{ ...item, position, updatedAt: now, revision: item.revision + 1 }]));
      await touchTrip(this.database, tripId);
    });
  }
}