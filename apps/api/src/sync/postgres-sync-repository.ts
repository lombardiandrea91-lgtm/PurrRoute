import type { SyncTripRequest, SyncTripResponse } from '@purrroute/contracts';
import type { Database, QueryExecutor } from '../db/database.ts';

interface TripRow extends Record<string, unknown> {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  time_zone: string | null;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
  sync_version: string | number;
}

interface DayRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  day_date: string;
  position: number;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface StopRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  category: SyncTripRequest['stops'][number]['category'];
  planning_state: SyncTripRequest['stops'][number]['planningState'];
  is_favorite: boolean;
  visited_at: Date | string | null;
  position: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduled_at: Date | string | null;
  duration_minutes: number | null;
  location_source: SyncTripRequest['stops'][number]['locationSource'];
  source_place_id: string | null;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface ListRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  title: string;
  kind: SyncTripRequest['lists'][number]['kind'];
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface ListItemRow extends Record<string, unknown> {
  id: string;
  list_id: string;
  label: string;
  checked_at: Date | string | null;
  position: number;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface ExpenseRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  description: string;
  amount_minor: string | number;
  currency: string;
  spent_at: Date | string | null;
  paid_by_user_id: string | null;
  revision: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export type SyncPushResult =
  | { kind: 'saved'; snapshot: SyncTripResponse }
  | { kind: 'conflict'; current: SyncTripResponse | null }
  | { kind: 'not_found' };

export class SyncPayloadError extends Error {
  constructor() {
    super('invalid_sync_payload');
  }
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function toSnapshot(
  trip: TripRow,
  days: DayRow[],
  stops: StopRow[],
  lists: ListRow[],
  listItems: ListItemRow[],
  expenses: ExpenseRow[],
  syncedAt: string,
): SyncTripResponse {
  const version = Number(trip.sync_version);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('invalid_database_sync_version');
  return {
    version,
    trip: {
      id: trip.id,
      title: trip.title,
      description: trip.description,
      startsOn: trip.starts_on,
      endsOn: trip.ends_on,
      timeZone: trip.time_zone,
      revision: trip.revision,
      createdAt: iso(trip.created_at) as string,
      updatedAt: iso(trip.updated_at) as string,
      deletedAt: iso(trip.deleted_at),
    },
    days: days.map((day) => ({
      id: day.id,
      tripId: day.trip_id,
      date: dateOnly(day.day_date),
      position: day.position,
      revision: day.revision,
      createdAt: iso(day.created_at) as string,
      updatedAt: iso(day.updated_at) as string,
      deletedAt: iso(day.deleted_at),
    })),
    stops: stops.map((stop) => ({
      id: stop.id,
      tripId: stop.trip_id,
      dayId: stop.day_id,
      name: stop.name,
      category: stop.category,
      planningState: stop.planning_state,
      isFavorite: stop.is_favorite,
      visitedAt: iso(stop.visited_at),
      position: stop.position,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      scheduledAt: iso(stop.scheduled_at),
      durationMinutes: stop.duration_minutes,
      locationSource: stop.location_source,
      sourcePlaceId: stop.source_place_id,
      revision: stop.revision,
      createdAt: iso(stop.created_at) as string,
      updatedAt: iso(stop.updated_at) as string,
      deletedAt: iso(stop.deleted_at),
    })),
    lists: lists.map((list) => ({
      id: list.id,
      tripId: list.trip_id,
      title: list.title,
      kind: list.kind,
      revision: list.revision,
      createdAt: iso(list.created_at) as string,
      updatedAt: iso(list.updated_at) as string,
      deletedAt: iso(list.deleted_at),
    })),
    listItems: listItems.map((item) => ({
      id: item.id,
      listId: item.list_id,
      label: item.label,
      checkedAt: iso(item.checked_at),
      position: item.position,
      revision: item.revision,
      createdAt: iso(item.created_at) as string,
      updatedAt: iso(item.updated_at) as string,
      deletedAt: iso(item.deleted_at),
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      tripId: expense.trip_id,
      description: expense.description,
      amountMinor: Number(expense.amount_minor),
      currency: expense.currency.trim(),
      spentAt: iso(expense.spent_at),
      paidByUserId: expense.paid_by_user_id,
      revision: expense.revision,
      createdAt: iso(expense.created_at) as string,
      updatedAt: iso(expense.updated_at) as string,
      deletedAt: iso(expense.deleted_at),
    })),
    syncedAt,
  };
}

async function readSnapshot(
  connection: QueryExecutor,
  userId: string,
  tripId: string,
): Promise<SyncTripResponse | null> {
  const result = await connection.query<TripRow>(
    `SELECT * FROM trips WHERE id = $1 AND owner_id = $2`,
    [tripId, userId],
  );
  const trip = result.rows[0];
  if (!trip) return null;
  const [dayResult, stopResult, listResult, itemResult, expenseResult] = await Promise.all([
    connection.query<DayRow>('SELECT * FROM trip_days WHERE trip_id = $1 ORDER BY position, id', [tripId]),
    connection.query<StopRow>('SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY position, id', [tripId]),
    connection.query<ListRow>('SELECT * FROM trip_lists WHERE trip_id = $1 ORDER BY created_at, id', [tripId]),
    connection.query<ListItemRow>(
      `SELECT item.* FROM trip_list_items item JOIN trip_lists list ON list.id = item.list_id
        WHERE list.trip_id = $1 ORDER BY item.list_id, item.position, item.id`, [tripId]),
    connection.query<ExpenseRow>('SELECT * FROM trip_expenses WHERE trip_id = $1 ORDER BY spent_at DESC NULLS LAST, id', [tripId]),
  ]);
  return toSnapshot(trip, dayResult.rows, stopResult.rows, listResult.rows, itemResult.rows,
    expenseResult.rows, new Date().toISOString());
}

function validateRelations(request: SyncTripRequest): void {
  const tripId = request.trip.id;
  if (request.trip.startsOn && request.trip.endsOn && request.trip.endsOn < request.trip.startsOn) {
    throw new SyncPayloadError();
  }
  const dayIds = new Set<string>();
  const dayDates = new Set<string>();
  for (const day of request.days) {
    if (day.tripId !== tripId || dayIds.has(day.id) || dayDates.has(day.date)) throw new SyncPayloadError();
    dayIds.add(day.id);
    dayDates.add(day.date);
  }
  const stopIds = new Set<string>();
  for (const stop of request.stops) {
    if (stop.tripId !== tripId || stopIds.has(stop.id)
      || (stop.dayId !== null && !dayIds.has(stop.dayId))
      || ((stop.latitude === null) !== (stop.longitude === null))
      || (stop.locationSource === 'locationiq' && (!stop.sourcePlaceId || stop.latitude === null))
      || (stop.locationSource !== 'locationiq' && stop.sourcePlaceId !== null)) {
      throw new SyncPayloadError();
    }
    stopIds.add(stop.id);
  }
  const listIds = new Set<string>();
  for (const list of request.lists) {
    if (list.tripId !== tripId || listIds.has(list.id)) throw new SyncPayloadError();
    listIds.add(list.id);
  }
  const itemIds = new Set<string>();
  for (const item of request.listItems) {
    if (!listIds.has(item.listId) || itemIds.has(item.id)) throw new SyncPayloadError();
    itemIds.add(item.id);
  }
  const expenseIds = new Set<string>();
  for (const expense of request.expenses) {
    if (expense.tripId !== tripId || expenseIds.has(expense.id)
      || !Number.isSafeInteger(expense.amountMinor) || expense.amountMinor < 0
      || !/^[A-Z]{3}$/.test(expense.currency)) throw new SyncPayloadError();
    expenseIds.add(expense.id);
  }
}

export class PostgresSyncRepository {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  getTrip(userId: string, tripId: string): Promise<SyncTripResponse | null> {
    return this.database.transaction((connection) => readSnapshot(connection, userId, tripId));
  }

  listTrips(userId: string): Promise<SyncTripResponse[]> {
    return this.database.transaction(async (connection) => {
      const result = await connection.query<{ id: string }>(
        `SELECT id FROM trips WHERE owner_id = $1 AND deleted_at IS NULL
          ORDER BY updated_at DESC, id LIMIT 1000`,
        [userId],
      );
      const snapshots = await Promise.all(result.rows.map((trip) => readSnapshot(connection, userId, trip.id)));
      return snapshots.filter((snapshot): snapshot is SyncTripResponse => snapshot !== null);
    });
  }

  async pushTrip(userId: string, request: SyncTripRequest): Promise<SyncPushResult> {
    validateRelations(request);
    return this.database.transaction(async (connection) => {
      const trip = request.trip;
      let versionResult;
      if (request.expectedVersion === 0) {
        versionResult = await connection.query<{ sync_version: string | number }>(
          `INSERT INTO trips
            (id, owner_id, title, description, starts_on, ends_on, time_zone, revision,
              created_at, updated_at, deleted_at, sync_version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, 1)
            ON CONFLICT (id) DO NOTHING
            RETURNING sync_version`,
          [trip.id, userId, trip.title, trip.description, trip.startsOn, trip.endsOn,
            trip.timeZone, trip.revision, trip.createdAt, trip.deletedAt],
        );
      } else {
        versionResult = await connection.query<{ sync_version: string | number }>(
          `UPDATE trips SET title = $3, description = $4, starts_on = $5, ends_on = $6,
              time_zone = $7, revision = GREATEST(revision + 1, $8), updated_at = now(),
              deleted_at = $9, sync_version = sync_version + 1
            WHERE id = $1 AND owner_id = $2 AND sync_version = $10
            RETURNING sync_version`,
          [trip.id, userId, trip.title, trip.description, trip.startsOn, trip.endsOn,
            trip.timeZone, trip.revision, trip.deletedAt, request.expectedVersion],
        );
      }

      if (versionResult.rows.length === 0) {
        const current = await readSnapshot(connection, userId, trip.id);
        return current || request.expectedVersion === 0
          ? { kind: 'conflict' as const, current }
          : { kind: 'not_found' as const };
      }

      for (const day of request.days) {
        const saved = await connection.query(
          `INSERT INTO trip_days
            (id, trip_id, day_date, position, revision, created_at, updated_at, deleted_at)
            VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
            ON CONFLICT (id) DO UPDATE SET day_date = EXCLUDED.day_date,
              position = EXCLUDED.position, revision = GREATEST(trip_days.revision + 1, EXCLUDED.revision),
              updated_at = now(), deleted_at = EXCLUDED.deleted_at
            WHERE trip_days.trip_id = EXCLUDED.trip_id`,
          [day.id, trip.id, day.date, day.position, day.revision, day.createdAt, day.deletedAt],
        );
        if (saved.rowCount !== 1) throw new SyncPayloadError();
      }

      for (const stop of request.stops) {
        const saved = await connection.query(
          `INSERT INTO trip_stops
            (id, trip_id, day_id, name, category, planning_state, is_favorite, visited_at,
              position, address, latitude, longitude, scheduled_at, duration_minutes,
              location_source, source_place_id, revision, created_at, updated_at, deleted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
              $17, $18, now(), $19)
            ON CONFLICT (id) DO UPDATE SET day_id = EXCLUDED.day_id, name = EXCLUDED.name,
              category = EXCLUDED.category, planning_state = EXCLUDED.planning_state,
              is_favorite = EXCLUDED.is_favorite, visited_at = EXCLUDED.visited_at,
              position = EXCLUDED.position, address = EXCLUDED.address, latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude, scheduled_at = EXCLUDED.scheduled_at,
              duration_minutes = EXCLUDED.duration_minutes, location_source = EXCLUDED.location_source,
              source_place_id = EXCLUDED.source_place_id,
              revision = GREATEST(trip_stops.revision + 1, EXCLUDED.revision),
              updated_at = now(), deleted_at = EXCLUDED.deleted_at
            WHERE trip_stops.trip_id = EXCLUDED.trip_id`,
          [stop.id, trip.id, stop.dayId, stop.name, stop.category, stop.planningState,
            stop.isFavorite, stop.visitedAt, stop.position, stop.address, stop.latitude,
            stop.longitude, stop.scheduledAt, stop.durationMinutes, stop.locationSource,
            stop.sourcePlaceId, stop.revision, stop.createdAt, stop.deletedAt],
        );
        if (saved.rowCount !== 1) throw new SyncPayloadError();
      }

      for (const list of request.lists) {
        const saved = await connection.query(
          `INSERT INTO trip_lists
            (id, trip_id, title, kind, revision, created_at, updated_at, deleted_at)
            VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, kind = EXCLUDED.kind,
              revision = GREATEST(trip_lists.revision + 1, EXCLUDED.revision),
              updated_at = now(), deleted_at = EXCLUDED.deleted_at
            WHERE trip_lists.trip_id = EXCLUDED.trip_id`,
          [list.id, trip.id, list.title, list.kind, list.revision, list.createdAt, list.deletedAt],
        );
        if (saved.rowCount !== 1) throw new SyncPayloadError();
      }

      for (const item of request.listItems) {
        const saved = await connection.query(
          `INSERT INTO trip_list_items
            (id, list_id, label, checked_at, position, revision, created_at, updated_at, deleted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
            ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, checked_at = EXCLUDED.checked_at,
              position = EXCLUDED.position,
              revision = GREATEST(trip_list_items.revision + 1, EXCLUDED.revision),
              updated_at = now(), deleted_at = EXCLUDED.deleted_at
            WHERE trip_list_items.list_id = EXCLUDED.list_id`,
          [item.id, item.listId, item.label, item.checkedAt, item.position,
            item.revision, item.createdAt, item.deletedAt],
        );
        if (saved.rowCount !== 1) throw new SyncPayloadError();
      }

      for (const expense of request.expenses) {
        const saved = await connection.query(
          `INSERT INTO trip_expenses
            (id, trip_id, description, amount_minor, currency, spent_at, paid_by_user_id,
              revision, created_at, updated_at, deleted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)
            ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description,
              amount_minor = EXCLUDED.amount_minor, currency = EXCLUDED.currency,
              spent_at = EXCLUDED.spent_at, paid_by_user_id = EXCLUDED.paid_by_user_id,
              revision = GREATEST(trip_expenses.revision + 1, EXCLUDED.revision),
              updated_at = now(), deleted_at = EXCLUDED.deleted_at
            WHERE trip_expenses.trip_id = EXCLUDED.trip_id`,
          [expense.id, trip.id, expense.description, expense.amountMinor, expense.currency,
            expense.spentAt, expense.paidByUserId, expense.revision, expense.createdAt, expense.deletedAt],
        );
        if (saved.rowCount !== 1) throw new SyncPayloadError();
      }

      const snapshot = await readSnapshot(connection, userId, trip.id);
      if (!snapshot) return { kind: 'not_found' as const };
      return { kind: 'saved' as const, snapshot };
    });
  }
}