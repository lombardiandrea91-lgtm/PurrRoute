import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { root } from './read-kit.mjs';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const output = join(root, 'test-results/design');
await mkdir(output, { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport, colorScheme: theme });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(pathToFileURL(join(root, 'packages/design-system/preview.html')).href);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.ui-grid figure').count(), 24);
      assert.equal(await page.locator('.states figure').count(), 10);
      assert.ok(await page.evaluate(() => document.fonts.check('400 16px "Plus Jakarta Sans"')));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('radio', { name: 'Gatta cipria', exact: true }).check();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-asset]')].every((image) => image.complete && image.naturalWidth > 0 && image.src.endsWith('-cipria.png')));
      await page.getByRole('radio', { name: 'Scuro', exact: true }).check();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.getByRole('radio', { name: 'Chiaro', exact: true }).check();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await page.getByRole('radio', { name: 'Sistema', exact: true }).check();
      assert.equal(await page.locator('html').getAttribute('data-theme'), null);
      await page.screenshot({ path: join(output, `${viewport.width}-${theme}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS: ${viewport.width}px ${theme}, font, SVG, PNG, theme and cat controls.`);
    }
  }
} finally {
  await browser.close();
}