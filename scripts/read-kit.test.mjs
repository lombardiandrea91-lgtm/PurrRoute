import assert from 'node:assert/strict';
import test from 'node:test';
import { readKit } from './read-kit.mjs';

test('il kit contiene 24 icone, 14 categorie e due gatti', () => {
  const kit = readKit();
  assert.equal(kit.UI.length, 24);
  assert.equal(kit.PINS.length, 14);
  assert.deepEqual(Object.keys(kit.CATS), ['rosso', 'cipria']);
  assert.equal(new Set(kit.UI.map(([name]) => name)).size, 24);
  assert.equal(new Set(kit.PINS.map(([, , name]) => name)).size, 14);
});

test('gli stati, le icone app e gli elementi mappa vengono dal kit originale', () => {
  const kit = readKit();
  for (const cat of ['rosso', 'cipria']) {
    const states = ['n', 'z', 'h', 'v'].map((state) => kit.face(cat, state));
    assert.equal(new Set(states).size, 4);
    assert.match(kit.appIcon(cat, 512), /viewBox="0 0 120 120"/);
  }
  assert.match(kit.elements.get('special').innerHTML, /Sei qui/);
  assert.match(kit.elements.get('special').innerHTML, /Gruppo/);
  assert.match(kit.elements.get('route').innerHTML, /stroke-dasharray/);
  assert.match(kit.html, /Quindici categorie/);
});