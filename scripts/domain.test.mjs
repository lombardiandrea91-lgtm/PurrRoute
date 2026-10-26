import assert from 'node:assert/strict';
import test from 'node:test';
import { createStopMarkers, stopCategories, stopPlanningStates } from '../packages/domain/src/index.ts';

test('le categorie del dominio corrispondono ai 14 pin del kit', () => {
  assert.deepEqual(stopCategories, [
    'departure', 'destination', 'waypoint', 'lodging', 'restaurant', 'cafe', 'attraction',
    'museum', 'train', 'flight', 'car', 'nature', 'beach', 'shopping',
  ]);
});

test('preferito e visitato sono marcatori indipendenti', () => {
  assert.deepEqual(stopPlanningStates, ['planned', 'optional']);
  assert.deepEqual(createStopMarkers(), { isFavorite: false, visitedAt: null });
  assert.deepEqual(createStopMarkers({ isFavorite: true, visitedAt: '2026-10-26T12:00:00.000Z' }), {
    isFavorite: true,
    visitedAt: '2026-10-26T12:00:00.000Z',
  });
});