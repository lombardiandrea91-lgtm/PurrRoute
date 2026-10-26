export const up = (pgm) => pgm.sql(`
  ALTER TABLE trip_stops ADD COLUMN location_source text;
  ALTER TABLE trip_stops ADD COLUMN source_place_id text;
  ALTER TABLE trip_stops ADD CONSTRAINT trip_stops_location_source_check
    CHECK (location_source IS NULL OR location_source IN ('manual', 'locationiq'));
  ALTER TABLE trip_stops ADD CONSTRAINT trip_stops_source_place_id_check
    CHECK (
      (location_source = 'locationiq' AND source_place_id IS NOT NULL)
      OR (location_source IS DISTINCT FROM 'locationiq' AND source_place_id IS NULL)
    );
`);

export const down = (pgm) => pgm.sql(`
  ALTER TABLE trip_stops DROP CONSTRAINT trip_stops_source_place_id_check;
  ALTER TABLE trip_stops DROP CONSTRAINT trip_stops_location_source_check;
  ALTER TABLE trip_stops DROP COLUMN source_place_id;
  ALTER TABLE trip_stops DROP COLUMN location_source;
`);