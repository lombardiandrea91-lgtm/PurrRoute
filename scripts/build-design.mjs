import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { readKit, root } from './read-kit.mjs';

const kit = readKit();
const directory = join(root, 'packages/design-system');
await mkdir(join(directory, 'src'), { recursive: true });
await mkdir(join(directory, 'assets'), { recursive: true });
await mkdir(join(directory, 'fonts'), { recursive: true });

const slug = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const graphics = {};
const add = (id, viewBox, body, label) => { graphics[id] = { viewBox, body, label }; };

for (const [name, body] of kit.UI) {
  add(`ui-${slug(name)}`, '0 0 24 24', `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>`, name);
}
for (const [name, color, glyph] of kit.PINS) {
  add(`pin-${glyph}`, '0 0 48 60', `<g style="color:${color}"><use href="#ep"/></g><g transform="translate(13 14) scale(.9)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff">${kit.GL[glyph]}</g>`, name);
}
const states = { tappa: ['n', 'Tappa'], opzionale: ['z', 'Opzionale'], preferito: ['h', 'Preferito'], visitato: ['v', 'Visitato'] };
for (const cat of ['rosso', 'cipria']) {
  for (const [state, [mode, label]] of Object.entries(states)) {
    add(`cat-${cat}-${state}`, '0 0 48 60', kit.face(cat, mode), `${kit.CATS[cat].n}: ${label}`);
  }
  add(`app-${cat}`, '0 0 120 120', kit.appIcon(cat, 120).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''), kit.CATS[cat].n);
}
add('logo', '0 0 120 120', kit.logoBoth(120).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''), 'purrRoute');
const specials = [...kit.elements.get('special').innerHTML.matchAll(/<svg viewBox="([^"]+)">([\s\S]*?)<\/svg>/g)].slice(0, 2);
for (const [index, match] of specials.entries()) {
  add(index === 0 ? 'here' : 'cluster', match[1], match[2], index === 0 ? 'Sei qui' : 'Gruppo');
}
const route = kit.elements.get('route').innerHTML.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);
add('route', '0 0 360 120', route[1], 'Percorso');

const catalog = `export const definitions = ${JSON.stringify(kit.definitions)};\nexport const graphics = ${JSON.stringify(graphics, null, 2)} as const;\nexport const uiNames = ${JSON.stringify(kit.UI.map(([name]) => slug(name)))} as const;\nexport const categoryNames = ${JSON.stringify(kit.PINS.map(([, , glyph]) => glyph))} as const;\n`;
await writeFile(join(directory, 'src/catalog.ts'), catalog);

const standalone = (id, prefix) => {
  const graphic = graphics[id];
  const body = `<defs>${kit.definitions}</defs>${graphic.body}`
    .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${graphic.viewBox}" role="img" aria-label="${graphic.label}" focusable="false">${body}</svg>`;
};

const fontRevision = '8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5';
for (const [source, target] of [['PlusJakartaSans%5Bwght%5D.ttf', 'PlusJakartaSans.ttf'], ['OFL.txt', 'OFL.txt']]) {
  const targetPath = join(directory, 'fonts', target);
  try { await access(targetPath); } catch {
    const response = await fetch(`https://raw.githubusercontent.com/google/fonts/${fontRevision}/ofl/plusjakartasans/${source}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Download font fallito: ${response.status}`);
    await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
  }
}

const manifest = { source: kit.filename, sourceSha256: createHash('sha256').update(kit.html).digest('hex'), fontRevision, fontSha256: createHash('sha256').update(await readFile(join(directory, 'fonts/PlusJakartaSans.ttf'))).digest('hex'), assets: [] };
for (const cat of ['rosso', 'cipria']) {
  const source = standalone(`app-${cat}`, `app-${cat}`);
  for (const size of [192, 512]) {
    const filename = `app-${size}-${cat}.png`;
    await sharp(Buffer.from(source)).resize(size, size).png().toFile(join(directory, 'assets', filename));
    manifest.assets.push({ filename, size, purpose: 'any' });
  }
  const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 120 120"><rect width="120" height="120" fill="#0E151C"/><svg x="24" y="24" width="72" height="72" viewBox="0 0 120 120">${source.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg></svg>`;
  await sharp(Buffer.from(maskable)).png().toFile(join(directory, 'assets', `maskable-${cat}.png`));
  manifest.assets.push({ filename: `maskable-${cat}.png`, size: 512, purpose: 'maskable' });
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 120 120"><defs>${kit.definitions}</defs>${kit.favIcon(cat, 48).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
  await sharp(Buffer.from(favicon)).png().toFile(join(directory, 'assets', `favicon-${cat}.png`));
  manifest.assets.push({ filename: `favicon-${cat}.png`, size: 48, purpose: 'favicon' });
  const silhouette = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 120 120"><path d="M8 10L28 24Q50 18 72 24L92 10C96 30 94 50 88 62C80 77 64 83 50 83C36 83 20 77 12 62C6 50 4 30 8 10Z" transform="translate(10 10)" fill="#14202B"/></svg>`;
  await sharp(Buffer.from(silhouette)).png().toFile(join(directory, 'assets', `monochrome-${cat}.png`));
  manifest.assets.push({ filename: `monochrome-${cat}.png`, size: 512, purpose: 'monochrome' });
}
await writeFile(join(directory, 'assets/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const figure = (id) => `<figure>${standalone(id, `preview-${id}`)}<figcaption>${graphics[id].label}</figcaption></figure>`;
const palette = [['Sfondo', '#F5F3EF'], ['Inchiostro', '#14202B'], ['Teal', '#12B5A3'], ['Arancio', '#FFB067']]
  .map(([name, color]) => `<div class="swatch"><i style="--swatch:${color}" aria-hidden="true"></i><span>${name}<br>${color}</span></div>`).join('');
const assets = [['app-192', '192 px'], ['app-512', '512 px'], ['maskable', 'Maskable'], ['monochrome', 'Monocromatica'], ['favicon', 'Favicon']]
  .map(([name, label]) => `<figure><img class="${name === 'monochrome' ? 'mono' : ''}" data-asset="${name}" data-label="${label}" src="assets/${name}-rosso.png" alt="${label}, rosso" width="96" height="96"><figcaption>${label}</figcaption><a data-download="${name}" href="assets/${name}-rosso.png" download>Scarica PNG</a></figure>`).join('');
const replacements = {
  LOGO: standalone('logo', 'preview-logo'),
  PALETTE: palette,
  STATES: Object.keys(graphics).filter((id) => id.startsWith('cat-')).map(figure).join(''),
  CATEGORIES: Object.keys(graphics).filter((id) => id.startsWith('pin-')).map(figure).join(''),
  ICONS: Object.keys(graphics).filter((id) => id.startsWith('ui-')).map(figure).join(''),
  SPECIALS: ['here', 'cluster'].map(figure).join(''),
  ROUTE: standalone('route', 'preview-route').replace('<svg ', '<svg class="route" '),
  ASSETS: assets,
};
let preview = await readFile(join(directory, 'preview.template.html'), 'utf8');
for (const [name, value] of Object.entries(replacements)) preview = preview.replace(`%%${name}%%`, value);
await writeFile(join(directory, 'preview.html'), preview);
console.log(`Generated ${kit.UI.length} UI icons, ${kit.PINS.length} categories, 8 cat states and ${manifest.assets.length} PNG assets.`);