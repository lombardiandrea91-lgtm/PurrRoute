export const up = (pgm) => pgm.sql(`
  ALTER TABLE trip_stops ADD COLUMN scheduled_at timestamptz;
  ALTER TABLE trip_stops ADD COLUMN duration_minutes integer
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
`);

export const down = (pgm) => pgm.sql(`
  ALTER TABLE trip_stops DROP COLUMN duration_minutes;
  ALTER TABLE trip_stops DROP COLUMN scheduled_at;
`);