import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderSvg } from '../packages/design-system/src/index.ts';
import { graphics } from '../packages/design-system/src/catalog.ts';
import { themes } from '../packages/design-system/src/tokens.ts';
import { root, readKit } from './read-kit.mjs';

const directory = join(root, 'packages/design-system');

test('ogni SVG risolve riferimenti locali senza collisioni tra istanze', () => {
  for (const id of Object.keys(graphics)) {
    const markup = renderSvg(id, `test-${id}`, 'Un luogo & un gatto');
    const ids = new Set([...markup.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
    for (const match of markup.matchAll(/(?:href="#|url\(#)([^"\)]+)/g)) {
      assert.ok(ids.has(match[1]), `${id}: riferimento mancante ${match[1]}`);
    }
    assert.match(markup, /aria-label="Un luogo &amp; un gatto"/);
  }
  assert.notEqual(renderSvg('logo', 'first'), renderSvg('logo', 'second'));
  assert.match(renderSvg('logo', 'decorative'), /aria-hidden="true"/);
  assert.throws(() => renderSvg('logo', 'invalid"'), /non valido/);
});

test('i PNG sono quadrati, non vuoti e delle dimensioni dichiarate', async () => {
  const manifest = JSON.parse(await readFile(join(directory, 'assets/manifest.json'), 'utf8'));
  assert.equal(manifest.assets.length, 10);
  const kit = readKit();
  assert.equal(manifest.sourceSha256, createHash('sha256').update(kit.html).digest('hex'));
  for (const asset of manifest.assets) {
    const image = sharp(join(directory, 'assets', asset.filename));
    const metadata = await image.metadata();
    assert.equal(metadata.width, asset.size);
    assert.equal(metadata.height, asset.size);
    assert.equal(metadata.format, 'png');
    const stats = await image.stats();
    assert.ok(stats.channels.some((channel) => channel.stdev > 1), asset.filename);
    if (asset.purpose === 'maskable') assert.ok(stats.isOpaque);
    if (asset.purpose === 'monochrome') {
      const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let painted = 0;
      let transparent = 0;
      for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 0) { transparent++; continue; }
        if (data[offset + 3] === 255) {
          assert.deepEqual([...data.subarray(offset, offset + 3)], [20, 32, 43]);
          painted++;
        }
      }
      assert.ok(painted > 1000 && transparent > 1000);
    }
  }
});

test('font locale con licenza OFL, nessun caricamento font esterno nella preview', async () => {
  const font = await readFile(join(directory, 'fonts/PlusJakartaSans.ttf'));
  assert.equal(font.readUInt32BE(0), 0x00010000);
  assert.match(await readFile(join(directory, 'fonts/OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE Version 1.1/);
  const preview = await readFile(join(directory, 'preview.html'), 'utf8');
  assert.doesNotMatch(preview, /https?:\/\/fonts\./);
  assert.doesNotMatch(preview, /%%[A-Z]+%%/);
});

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('testo e azioni semantiche raggiungono AA sulle superfici dei due temi', () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const foreground of ['text', 'textSecondary', 'action']) {
      for (const background of ['background', 'surface', 'chip']) {
        const light = Math.max(luminance(theme[foreground]), luminance(theme[background]));
        const dark = Math.min(luminance(theme[foreground]), luminance(theme[background]));
        assert.ok((light + 0.05) / (dark + 0.05) >= 4.5, `${name}: ${foreground}/${background}`);
      }
    }
  }
});