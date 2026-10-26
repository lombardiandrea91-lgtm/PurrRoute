import Dexie, { type EntityTable } from 'dexie';
import type { Trip, TripDay, TripExpense, TripList, TripListItem, TripStop } from '@purrroute/domain';

export interface LocalMetadata {
  id: string;
  value: string;
}

export interface LocalTripSyncState {
  id: string;
  accountId: string;
  serverVersion: number;
  localRevision: number;
  syncedAt: string;
}

export class PurrRouteLocalDatabase extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  days!: EntityTable<TripDay, 'id'>;
  stops!: EntityTable<TripStop, 'id'>;
  lists!: EntityTable<TripList, 'id'>;
  listItems!: EntityTable<TripListItem, 'id'>;
  expenses!: EntityTable<TripExpense, 'id'>;
  metadata!: EntityTable<LocalMetadata, 'id'>;
  syncStates!: EntityTable<LocalTripSyncState, 'id'>;

  constructor(name = 'purrroute-local') {
    super(name);
    this.version(1).stores({
      trips: 'id, ownerId, updatedAt, deletedAt',
      days: 'id, tripId, date, position, updatedAt, deletedAt',
      stops: 'id, tripId, dayId, category, planningState, position, isFavorite, visitedAt, updatedAt, deletedAt',
      metadata: 'id',
    });
    this.version(2).stores({
      trips: 'id, ownerId, updatedAt, deletedAt',
      days: 'id, tripId, date, position, updatedAt, deletedAt',
      stops: 'id, tripId, dayId, category, planningState, position, isFavorite, visitedAt, updatedAt, deletedAt',
      metadata: 'id',
      syncStates: 'id, accountId, serverVersion',
    });
    this.version(3).stores({
      trips: 'id, ownerId, updatedAt, deletedAt',
      days: 'id, tripId, date, position, updatedAt, deletedAt',
      stops: 'id, tripId, dayId, category, planningState, position, isFavorite, visitedAt, updatedAt, deletedAt',
      lists: 'id, tripId, kind, updatedAt, deletedAt',
      listItems: 'id, listId, position, updatedAt, deletedAt',
      expenses: 'id, tripId, spentAt, currency, updatedAt, deletedAt',
      metadata: 'id',
      syncStates: 'id, accountId, serverVersion',
    });
    this.version(4).stores({
      trips: 'id, ownerId, updatedAt, deletedAt',
      days: 'id, tripId, date, position, updatedAt, deletedAt',
      stops: 'id, tripId, dayId, category, planningState, position, isFavorite, visitedAt, updatedAt, deletedAt',
      lists: 'id, tripId, kind, updatedAt, deletedAt',
      listItems: 'id, listId, position, updatedAt, deletedAt',
      expenses: 'id, tripId, spentAt, currency, updatedAt, deletedAt',
      metadata: 'id',
      syncStates: 'id, accountId, serverVersion',
    }).upgrade((transaction) => transaction.table('stops').toCollection().modify((stop) => {
      stop.sourceUrl ??= null;
    }));
  }
}

export const tripDatabase = new PurrRouteLocalDatabase();

export function createTripDatabase(name: string): PurrRouteLocalDatabase {
  return new PurrRouteLocalDatabase(name);
}