import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './read-kit.mjs';

const source = join(root, 'packages/design-system');
const target = join(root, 'apps/web/public');
await mkdir(join(target, 'app-assets'), { recursive: true });
await mkdir(join(target, 'licenses'), { recursive: true });
for (const file of await readdir(join(source, 'assets'))) {
  if (file.endsWith('.png')) await copyFile(join(source, 'assets', file), join(target, 'app-assets', file));
}
await copyFile(join(source, 'fonts/OFL.txt'), join(target, 'licenses/PlusJakartaSans-OFL.txt'));
console.log('Prepared local app icons and font license.');