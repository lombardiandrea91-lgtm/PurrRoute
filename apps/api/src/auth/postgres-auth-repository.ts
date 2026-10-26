import type { Database, QueryExecutor } from '../db/database.ts';
import type {
  AccountRecord,
  AccountTokenPurpose,
  AuthRepository,
  PublicAccount,
  RegisterAccountInput,
  SessionInput,
} from './repository.ts';

interface AccountRow extends Record<string, unknown> {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SessionRow extends AccountRow {
  expires_at: Date | string;
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapAccount(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerifiedAt: toIso(row.email_verified_at),
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

function isEmailConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const databaseError = error as { code?: string; constraint?: string };
  return databaseError.code === '23505' && databaseError.constraint === 'users_email_unique';
}

async function readAccountExport(
  connection: QueryExecutor,
  userId: string,
  exportedAt: string,
): Promise<Record<string, unknown> | null> {
  const accountResult = await connection.query<AccountRow>(
    `SELECT id, email, email_verified_at, created_at, updated_at
      FROM users WHERE id = $1`,
    [userId],
  );
  const accountRow = accountResult.rows[0];
  if (!accountRow) return null;

  const tripResult = await connection.query<{ id: string }>(
    'SELECT id FROM trips WHERE owner_id = $1 ORDER BY created_at, id',
    [userId],
  );
  const tripIds = tripResult.rows.map((trip) => trip.id);
  const collections = await Promise.all([
    connection.query('SELECT * FROM trips WHERE owner_id = $1 ORDER BY created_at, id', [userId]),
    connection.query(
      `SELECT * FROM trip_memberships
        WHERE user_id = $1 OR trip_id IN (SELECT id FROM trips WHERE owner_id = $1)
        ORDER BY created_at, id`,
      [userId],
    ),
    connection.query('SELECT * FROM trip_days WHERE trip_id = ANY($1::uuid[]) ORDER BY trip_id, position', [tripIds]),
    connection.query('SELECT * FROM trip_stops WHERE trip_id = ANY($1::uuid[]) ORDER BY trip_id, position, id', [tripIds]),
    connection.query('SELECT * FROM trip_notes WHERE trip_id = ANY($1::uuid[]) ORDER BY trip_id, created_at, id', [tripIds]),
    connection.query('SELECT * FROM trip_lists WHERE trip_id = ANY($1::uuid[]) ORDER BY trip_id, created_at, id', [tripIds]),
    connection.query(
      `SELECT item.* FROM trip_list_items item
        JOIN trip_lists list ON list.id = item.list_id
        WHERE list.trip_id = ANY($1::uuid[]) ORDER BY item.list_id, item.position`,
      [tripIds],
    ),
    connection.query('SELECT * FROM trip_expenses WHERE trip_id = ANY($1::uuid[]) ORDER BY trip_id, spent_at, id', [tripIds]),
    connection.query('SELECT * FROM trip_documents WHERE trip_id = ANY($1::uuid[]) ORDER BY trip_id, created_at, id', [tripIds]),
  ]);

  const [trips, memberships, days, stops, notes, lists, items, expenses, documents] = collections;
  return {
    exportVersion: 1,
    exportedAt,
    account: {
      id: accountRow.id,
      email: accountRow.email,
      email_verified_at: accountRow.email_verified_at,
      created_at: accountRow.created_at,
      updated_at: accountRow.updated_at,
    },
    trips: trips.rows,
    memberships: memberships.rows,
    days: days.rows,
    stops: stops.rows,
    notes: notes.rows,
    lists: lists.rows,
    listItems: items.rows,
    expenses: expenses.rows,
    documents: documents.rows,
  };
}

export class PostgresAuthRepository implements AuthRepository {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async registerAccount(input: RegisterAccountInput): Promise<boolean> {
    try {
      await this.database.transaction(async (connection) => {
        await connection.query(
          `INSERT INTO users (id, email, password_hash)
            VALUES ($1, $2, $3)`,
          [input.id, input.email, input.passwordHash],
        );
        await connection.query(
          `INSERT INTO account_tokens (token_hash, user_id, purpose, expires_at)
            VALUES ($1, $2, 'email_verification', $3)`,
          [input.tokenHash, input.id, input.tokenExpiresAt],
        );
      });
      return true;
    } catch (error) {
      if (isEmailConflict(error)) return false;
      throw error;
    }
  }

  async findAccountByEmail(email: string): Promise<AccountRecord | null> {
    const result = await this.database.query<AccountRow>(
      `SELECT id, email, password_hash, email_verified_at, created_at, updated_at
        FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async findAccountById(id: string): Promise<AccountRecord | null> {
    const result = await this.database.query<AccountRow>(
      `SELECT id, email, password_hash, email_verified_at, created_at, updated_at
        FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async issueTokenForEmail(
    email: string,
    purpose: AccountTokenPurpose,
    tokenHash: Buffer,
    expiresAt: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (connection) => {
      const userResult = await connection.query<{ id: string }>(
        `SELECT id FROM users
          WHERE email = $1
            AND (($2 = 'email_verification' AND email_verified_at IS NULL)
              OR ($2 = 'password_reset' AND email_verified_at IS NOT NULL))`,
        [email, purpose],
      );
      const userId = userResult.rows[0]?.id;
      if (!userId) return false;

      await connection.query(
        `UPDATE account_tokens SET consumed_at = now()
          WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
        [userId, purpose],
      );
      await connection.query(
        `INSERT INTO account_tokens (token_hash, user_id, purpose, expires_at)
          VALUES ($1, $2, $3, $4)`,
        [tokenHash, userId, purpose, expiresAt],
      );
      return true;
    });
  }

  async consumeVerificationToken(tokenHash: Buffer): Promise<boolean> {
    return this.database.transaction(async (connection) => {
      const result = await connection.query<{ user_id: string }>(
        `UPDATE account_tokens SET consumed_at = now()
          WHERE token_hash = $1 AND purpose = 'email_verification'
            AND consumed_at IS NULL AND expires_at > now()
          RETURNING user_id`,
        [tokenHash],
      );
      const userId = result.rows[0]?.user_id;
      if (!userId) return false;

      await connection.query(
        `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
          WHERE id = $1`,
        [userId],
      );
      return true;
    });
  }

  async consumePasswordResetToken(tokenHash: Buffer, passwordHash: string): Promise<boolean> {
    return this.database.transaction(async (connection) => {
      const result = await connection.query<{ user_id: string }>(
        `UPDATE account_tokens SET consumed_at = now()
          WHERE token_hash = $1 AND purpose = 'password_reset'
            AND consumed_at IS NULL AND expires_at > now()
          RETURNING user_id`,
        [tokenHash],
      );
      const userId = result.rows[0]?.user_id;
      if (!userId) return false;

      await connection.query(
        'UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1',
        [userId, passwordHash],
      );
      await connection.query(
        'UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
      return true;
    });
  }

  async createSession(input: SessionInput): Promise<void> {
    await this.database.query(
      'INSERT INTO user_sessions (session_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [input.sessionHash, input.userId, input.expiresAt],
    );
  }

  async findSession(sessionHash: Buffer): Promise<(PublicAccount & { expiresAt: string }) | null> {
    const result = await this.database.query<SessionRow>(
      `SELECT u.id, u.email, u.password_hash, u.email_verified_at, u.created_at, u.updated_at,
          s.expires_at
        FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.session_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
          AND u.email_verified_at IS NOT NULL`,
      [sessionHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    const { passwordHash: _passwordHash, ...account } = mapAccount(row);
    return { ...account, expiresAt: toIso(row.expires_at) as string };
  }

  async revokeSession(sessionHash: Buffer): Promise<void> {
    await this.database.query(
      'UPDATE user_sessions SET revoked_at = now() WHERE session_hash = $1 AND revoked_at IS NULL',
      [sessionHash],
    );
  }

  exportAccount(userId: string, exportedAt: string): Promise<Record<string, unknown> | null> {
    return this.database.transaction(async (connection) => {
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return readAccountExport(connection, userId, exportedAt);
    });
  }

  async deleteAccount(userId: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM users WHERE id = $1', [userId]);
    return result.rowCount > 0;
  }
}