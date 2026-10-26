import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './read-kit.mjs';

const directory = join(root, 'apps/web/dist');
const manifest = JSON.parse(await readFile(join(directory, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.name, 'purrRoute');
assert.equal(manifest.id, '/');
assert.equal(manifest.start_url, '/trips');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
for (const purpose of ['any', 'maskable', 'monochrome']) {
  assert.ok(manifest.icons.some((icon) => icon.purpose === purpose), purpose);
}
for (const size of ['192x192', '512x512']) {
  assert.ok(manifest.icons.some((icon) => icon.sizes === size && icon.purpose === 'any'), size);
}
for (const icon of manifest.icons) {
  assert.match(icon.src, /^\/app-assets\/[a-z0-9-]+\.png$/);
  await access(join(directory, icon.src.slice(1)));
}
const serviceWorker = await readFile(join(directory, 'sw.js'), 'utf8');
assert.match(serviceWorker, /purrroute-map-tiles/);
assert.match(serviceWorker, /\/api\/maps\/tiles\//);
await access(join(directory, 'offline.html'));
await access(join(directory, 'licenses/PlusJakartaSans-OFL.txt'));
const index = await readFile(join(directory, 'index.html'), 'utf8');
assert.match(index, /manifest\.webmanifest/);
assert.doesNotMatch(index, /fonts\.googleapis|VITE_.*(?:KEY|SECRET)/);
console.log('PASS: built PWA manifest, icon purposes and sizes, service worker, offline page and font license.');