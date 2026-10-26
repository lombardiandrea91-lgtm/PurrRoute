import assert from 'node:assert/strict';
import test from 'node:test';
import { createSchematicRoute, openFreeMapTiles } from '../apps/web/src/maps/adapters.ts';

test('tile source is replaceable and uses the documented OpenFreeMap public style', () => {
  assert.equal(openFreeMapTiles.id, 'openfreemap');
  assert.equal(openFreeMapTiles.styleUrl, 'https://tiles.openfreemap.org/styles/positron');
  assert.match(openFreeMapTiles.attribution, /OpenMapTiles.*OpenStreetMap/);
});

test('schematic connector is only geometry and never claims road distance or duration', () => {
  const empty = createSchematicRoute([[12, 45]], 'Direct schematic connector, not a road route');
  assert.deepEqual(empty.features, []);
  const line = createSchematicRoute([[12, 45], [13, 46]], 'Direct schematic connector, not a road route');
  assert.deepEqual(line.features[0], {
    type: 'Feature',
    properties: { kind: 'schematic', label: 'Direct schematic connector, not a road route' },
    geometry: { type: 'LineString', coordinates: [[12, 45], [13, 46]] },
  });
});