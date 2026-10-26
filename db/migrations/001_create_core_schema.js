export const up = (pgm) => pgm.sql(`
  CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text NOT NULL CHECK (email = lower(email)),
    password_hash text NOT NULL,
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX users_email_unique ON users (email);

  CREATE TABLE user_sessions (
    session_hash bytea PRIMARY KEY CHECK (octet_length(session_hash) = 32),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (expires_at > created_at)
  );
  CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id);
  CREATE INDEX user_sessions_expiry_idx ON user_sessions (expires_at);

  CREATE TABLE account_tokens (
    token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    CHECK (expires_at > created_at)
  );
  CREATE INDEX account_tokens_user_purpose_idx ON account_tokens (user_id, purpose);
  CREATE INDEX account_tokens_expiry_idx ON account_tokens (expires_at);

  CREATE TABLE trips (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
    description text,
    starts_on date,
    ends_on date,
    time_zone text,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on),
    UNIQUE (id, owner_id)
  );
  CREATE INDEX trips_owner_updated_idx ON trips (owner_id, updated_at DESC);

  CREATE TABLE trip_memberships (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (trip_id, user_id)
  );
  CREATE INDEX trip_memberships_user_trip_idx ON trip_memberships (user_id, trip_id);

  CREATE TABLE trip_days (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_date date NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (trip_id, day_date),
    UNIQUE (trip_id, id)
  );
  CREATE INDEX trip_days_order_idx ON trip_days (trip_id, position);

  CREATE TABLE trip_stops (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_id uuid,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    category text NOT NULL CHECK (category IN (
      'departure', 'destination', 'waypoint', 'lodging', 'restaurant', 'cafe',
      'attraction', 'museum', 'train', 'flight', 'car', 'nature', 'beach', 'shopping'
    )),
    planning_state text NOT NULL DEFAULT 'planned'
      CHECK (planning_state IN ('planned', 'optional')),
    is_favorite boolean NOT NULL DEFAULT false,
    visited_at timestamptz,
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    address text,
    latitude double precision,
    longitude double precision,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
    UNIQUE (trip_id, id),
    FOREIGN KEY (trip_id, day_id) REFERENCES trip_days(trip_id, id) ON DELETE CASCADE
  );
  CREATE INDEX trip_stops_order_idx ON trip_stops (trip_id, day_id, position);

  CREATE TABLE trip_notes (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_id uuid,
    stop_id uuid,
    title text,
    body text NOT NULL,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (day_id IS NULL OR stop_id IS NULL),
    FOREIGN KEY (trip_id, day_id) REFERENCES trip_days(trip_id, id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id, stop_id) REFERENCES trip_stops(trip_id, id) ON DELETE CASCADE
  );
  CREATE INDEX trip_notes_trip_updated_idx ON trip_notes (trip_id, updated_at DESC);

  CREATE TABLE trip_lists (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
    kind text NOT NULL CHECK (kind IN ('checklist', 'packing')),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );
  CREATE INDEX trip_lists_trip_updated_idx ON trip_lists (trip_id, updated_at DESC);

  CREATE TABLE trip_list_items (
    id uuid PRIMARY KEY,
    list_id uuid NOT NULL REFERENCES trip_lists(id) ON DELETE CASCADE,
    label text NOT NULL CHECK (length(label) BETWEEN 1 AND 240),
    checked_at timestamptz,
    position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );
  CREATE INDEX trip_list_items_order_idx ON trip_list_items (list_id, position);

  CREATE TABLE trip_expenses (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    description text NOT NULL CHECK (length(description) BETWEEN 1 AND 240),
    amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    spent_at timestamptz,
    paid_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );
  CREATE INDEX trip_expenses_trip_date_idx ON trip_expenses (trip_id, spent_at);

  CREATE TABLE trip_documents (
    id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
    media_type text NOT NULL,
    byte_size bigint NOT NULL CHECK (byte_size >= 0),
    storage_key text UNIQUE,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );
  CREATE INDEX trip_documents_trip_updated_idx ON trip_documents (trip_id, updated_at DESC);
`);

export const down = (pgm) => pgm.sql(`
  DROP TABLE IF EXISTS trip_documents;
  DROP TABLE IF EXISTS trip_expenses;
  DROP TABLE IF EXISTS trip_list_items;
  DROP TABLE IF EXISTS trip_lists;
  DROP TABLE IF EXISTS trip_notes;
  DROP TABLE IF EXISTS trip_stops;
  DROP TABLE IF EXISTS trip_days;
  DROP TABLE IF EXISTS trip_memberships;
  DROP TABLE IF EXISTS trips;
  DROP TABLE IF EXISTS account_tokens;
  DROP TABLE IF EXISTS user_sessions;
  DROP TABLE IF EXISTS users;
`);