import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceBetweenCoordinates, findNearestUnvisitedStop } from '../apps/web/src/maps/arrival.ts';

function stop(id, latitude, longitude, visitedAt = null) {
  return { id, name: id, latitude, longitude, visitedAt };
}

test('distanza geodetica distingue coordinate uguali e piccoli spostamenti', () => {
  assert.equal(distanceBetweenCoordinates(41.9, 12.5, 41.9, 12.5), 0);
  const distance = distanceBetweenCoordinates(0, 0, 0.001, 0);
  assert.ok(distance > 110 && distance < 112);
});

test('avviso prossimità sceglie la tappa più vicina non visitata entro raggio', () => {
  const stops = [
    stop('far', 0.01, 0),
    stop('visited', 0, 0.0002, '2026-10-26T12:00:00.000Z'),
    stop('near', 0, 0.0003),
    stop('unlocated', null, null),
  ];
  const nearby = findNearestUnvisitedStop(stops, 0, 0, 100);
  assert.equal(nearby.stop.id, 'near');
  assert.ok(nearby.distanceMeters < 40);
  assert.equal(findNearestUnvisitedStop(stops, 0, 0, 20), null);
  assert.equal(findNearestUnvisitedStop(stops, 0, 0, 100, new Set(['near'])), null);
});