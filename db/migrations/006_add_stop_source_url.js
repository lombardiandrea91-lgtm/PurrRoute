export const up = (pgm) => pgm.sql(`
  ALTER TABLE trip_stops ADD COLUMN source_url text;
  ALTER TABLE trip_stops ADD CONSTRAINT trip_stops_source_url_check
    CHECK (source_url IS NULL OR (source_url LIKE 'https://%' AND length(source_url) <= 2048));
`);

export const down = (pgm) => pgm.sql(`
  ALTER TABLE trip_stops DROP CONSTRAINT trip_stops_source_url_check;
  ALTER TABLE trip_stops DROP COLUMN source_url;
`);