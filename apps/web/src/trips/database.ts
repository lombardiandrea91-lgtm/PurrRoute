import Dexie, { type EntityTable } from 'dexie';
import type { Trip, TripDay, TripStop } from '@purrroute/domain';

export interface LocalMetadata {
  id: string;
  value: string;
}

export class PurrRouteLocalDatabase extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  days!: EntityTable<TripDay, 'id'>;
  stops!: EntityTable<TripStop, 'id'>;
  metadata!: EntityTable<LocalMetadata, 'id'>;

  constructor(name = 'purrroute-local') {
    super(name);
    this.version(1).stores({
      trips: 'id, ownerId, updatedAt, deletedAt',
      days: 'id, tripId, date, position, updatedAt, deletedAt',
      stops: 'id, tripId, dayId, category, planningState, position, isFavorite, visitedAt, updatedAt, deletedAt',
      metadata: 'id',
    });
  }
}

export const tripDatabase = new PurrRouteLocalDatabase();

export function createTripDatabase(name: string): PurrRouteLocalDatabase {
  return new PurrRouteLocalDatabase(name);
}