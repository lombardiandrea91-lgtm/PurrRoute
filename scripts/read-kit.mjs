import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const root = fileURLToPath(new URL('../', import.meta.url));

export function readKit() {
  const filename = readdirSync(root).find((name) => name.endsWith('(v5).html'));
  if (!filename) throw new Error('Kit HTML v5 non trovato');
  const html = readFileSync(new URL(filename, new URL('../', import.meta.url)), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const definitions = html.match(/<defs>([\s\S]*?)<\/defs>/)?.[1];
  if (!source || !definitions) throw new Error('Struttura del kit non riconosciuta');
  const elements = new Map();
  const context = vm.createContext({
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { innerHTML: '', addEventListener() {} });
        return elements.get(id);
      },
    },
  });
  vm.runInContext(`${source}\nglobalThis.extracted = { UI, PINS, GL, CATS, face, head, appIcon, favIcon, logoBoth };`, context, { timeout: 1000 });
  return { ...context.extracted, definitions, filename, html, elements };
}