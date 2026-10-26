import { randomUUID } from 'node:crypto';
import type { TripMemberRole } from '@purrroute/domain';
import type { Database } from '../db/database.ts';

export interface TripCollaborator {
  userId: string;
  email: string;
  role: TripMemberRole;
}

export class PostgresTripCollaborationRepository {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  listMembers(ownerId: string, tripId: string): Promise<TripCollaborator[] | null> {
    return this.database.transaction(async (connection) => {
      const trip = await connection.query<{ owner_id: string; owner_email: string }>(
        `SELECT trip.owner_id, owner.email AS owner_email
          FROM trips trip JOIN users owner ON owner.id = trip.owner_id
          WHERE trip.id = $1 AND (
            trip.owner_id = $2 OR EXISTS (
              SELECT 1 FROM trip_memberships current_membership
              WHERE current_membership.trip_id = trip.id AND current_membership.user_id = $2
                AND current_membership.role IN ('editor', 'viewer') AND current_membership.deleted_at IS NULL
            )
          )`,
        [tripId, ownerId],
      );
      const owner = trip.rows[0];
      if (!owner) return null;
      const membershipRows = await connection.query<{ user_id: string; email: string; role: 'editor' | 'viewer' }>(
        `SELECT membership.user_id, users.email, membership.role
          FROM trip_memberships membership JOIN users ON users.id = membership.user_id
          WHERE membership.trip_id = $1 AND membership.user_id <> $2
            AND membership.role IN ('editor', 'viewer') AND membership.deleted_at IS NULL
          ORDER BY users.email, membership.user_id`,
        [tripId, owner.owner_id],
      );
      return [
        { userId: owner.owner_id, email: owner.owner_email, role: 'owner' },
        ...membershipRows.rows.map((member) => ({
          userId: member.user_id, email: member.email, role: member.role,
        })),
      ];
    });
  }

  addMember(ownerId: string, tripId: string, emailInput: string, role: 'editor' | 'viewer') {
    const email = emailInput.trim().toLowerCase();
    return this.database.transaction(async (connection) => {
      const trip = await connection.query<{ owner_id: string }>(
        'SELECT owner_id FROM trips WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [tripId, ownerId],
      );
      if (!trip.rows[0]) return null;
      const account = await connection.query<{ id: string; email: string }>(
        `SELECT id, email FROM users
          WHERE email = $1 AND email_verified_at IS NOT NULL AND id <> $2`,
        [email, ownerId],
      );
      const member = account.rows[0];
      if (!member) return null;
      const existingMembership = await connection.query<{ active: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM trip_memberships
          WHERE trip_id = $1 AND user_id = $2 AND role IN ('editor', 'viewer') AND deleted_at IS NULL
        ) AS active`,
        [tripId, member.id],
      );
      if (!existingMembership.rows[0]?.active) {
        const count = await connection.query<{ total: number | string }>(
          `SELECT count(*) AS total FROM trip_memberships
            WHERE trip_id = $1 AND role IN ('editor', 'viewer') AND deleted_at IS NULL`,
          [tripId],
        );
        if (Number(count.rows[0]?.total ?? 0) >= 99) return null;
      }
      const saved = await connection.query<{ user_id: string; email: string; role: 'editor' | 'viewer' }>(
        `INSERT INTO trip_memberships (id, trip_id, user_id, role)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (trip_id, user_id) DO UPDATE SET role = EXCLUDED.role,
            revision = trip_memberships.revision + 1, updated_at = now(), deleted_at = NULL
          WHERE trip_memberships.role IN ('editor', 'viewer')
          RETURNING user_id, role`,
        [randomUUID(), tripId, member.id, role],
      );
      const result = saved.rows[0];
      return result ? { userId: result.user_id, email: member.email, role: result.role } : null;
    });
  }

  removeMember(ownerId: string, tripId: string, memberId: string): Promise<boolean> {
    return this.database.transaction(async (connection) => {
      const trip = await connection.query<{ id: string }>(
        'SELECT id FROM trips WHERE id = $1 AND owner_id = $2', [tripId, ownerId],
      );
      if (!trip.rows[0]) return false;
      const removed = await connection.query(
        `UPDATE trip_memberships SET deleted_at = now(), updated_at = now(), revision = revision + 1
          WHERE trip_id = $1 AND user_id = $2 AND role IN ('editor', 'viewer') AND deleted_at IS NULL
          RETURNING id`,
        [tripId, memberId],
      );
      return removed.rowCount === 1;
    });
  }
}