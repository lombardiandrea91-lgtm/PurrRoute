import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePreferences, defaults } from '../apps/web/src/preferences.ts';
import { messages } from '../apps/web/src/messages.ts';

test('preferenze mancanti, corrotte o non oggetto usano default sicuri', () => {
  for (const value of [null, '', '{', 'null', '[]', 'false', '42']) {
    assert.deepEqual(parsePreferences(value), defaults);
  }
});

test('preferenze valide conservate, valori sconosciuti ignorati', () => {
  assert.deepEqual(parsePreferences('{"locale":"en","theme":"dark","cat":"cipria"}'), {
    locale: 'en', theme: 'dark', cat: 'cipria',
  });
  assert.deepEqual(parsePreferences('{"locale":"xx","theme":"broken","cat":"dog","token":"ignored"}'), defaults);
});

test('ogni messaggio esiste in italiano e inglese, senza etichette vuote', () => {
  assert.deepEqual(Object.keys(messages.it).sort(), Object.keys(messages.en).sort());
  for (const locale of ['it', 'en']) {
    for (const value of Object.values(messages[locale])) assert.ok(value.trim().length > 0);
  }
});