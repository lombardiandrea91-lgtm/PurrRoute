export const up = (pgm) => pgm.sql(`
  ALTER TABLE trips
    ADD COLUMN sync_version bigint NOT NULL DEFAULT 0
      CHECK (sync_version >= 0);
`);

export const down = (pgm) => pgm.sql(`
  ALTER TABLE trips DROP COLUMN sync_version;
`);