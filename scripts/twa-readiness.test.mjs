import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkTwaReadiness,
  TwaReadinessError,
  validateAssetLinks,
  validateTwaInputs,
  validateWebManifest,
} from './twa-readiness.mjs';

const fingerprint = Array.from({ length: 32 }, (_value, index) => index.toString(16).padStart(2, '0'))
  .join(':').toUpperCase();
const config = {
  origin: 'https://route.example',
  applicationId: 'com.example.purrroute',
  certificateFingerprint: fingerprint,
};
const manifest = {
  display: 'standalone',
  start_url: '/trips',
  scope: '/',
  icons: [
    { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
const assetLinks = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: config.applicationId,
    sha256_cert_fingerprints: [fingerprint],
  },
}];

test('TWA config rejects missing or unsafe origin and invalid app identity', () => {
  assert.throws(() => validateTwaInputs({ ...config, origin: '' }), TwaReadinessError);
  assert.throws(() => validateTwaInputs({ ...config, origin: 'http://route.example' }), /HTTPS origin/);
  assert.throws(() => validateTwaInputs({ ...config, origin: 'https://localhost' }), /public HTTPS origin/);
  assert.throws(() => validateTwaInputs({ ...config, applicationId: 'PurrRoute' }), /Android package ID/);
  assert.throws(() => validateTwaInputs({ ...config, certificateFingerprint: 'AA:BB' }), /32 colon-separated/);
});

test('Web Manifest must be standalone, same-origin, scoped and contain launch icons', () => {
  assert.equal(validateWebManifest(manifest, config.origin), manifest);
  assert.throws(() => validateWebManifest({ ...manifest, display: 'browser' }, config.origin), /display/);
  assert.throws(() => validateWebManifest({ ...manifest, start_url: 'https://other.example/trips' }, config.origin), /inside TWA_ORIGIN/);
  assert.throws(() => validateWebManifest({ ...manifest, icons: [] }, config.origin), /192x192/);
  assert.throws(() => validateWebManifest({ ...manifest, scope: '/app', start_url: '/application' }, config.origin), /inside TWA_ORIGIN/);
  assert.throws(() => validateWebManifest({ ...manifest, icons: [
    { src: 'http://[invalid', sizes: '192x192', type: 'image/png' },
    manifest.icons[1],
  ] }, config.origin), /192x192/);
});

test('assetlinks must match app ID, URL-handling relation and signing certificate', () => {
  assert.equal(validateAssetLinks(assetLinks, config.applicationId, fingerprint), assetLinks);
  assert.throws(() => validateAssetLinks(assetLinks, 'com.example.other', fingerprint), /does not delegate/);
  assert.throws(() => validateAssetLinks(assetLinks, config.applicationId, 'FF:'.repeat(31) + 'FF'), /does not delegate/);
});

test('published TWA check fetches manifest and assetlinks without following redirects', async () => {
  const calls = [];
  const result = await checkTwaReadiness(config, async (url, options) => {
    calls.push({ url: String(url), options });
    const body = String(url).endsWith('/manifest.webmanifest') ? manifest : assetLinks;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.deepEqual(result, { origin: config.origin, applicationId: config.applicationId });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.redirect === 'error'));
});

test('published TWA check fails on missing files and redirects', async () => {
  await assert.rejects(checkTwaReadiness(config, async () => new Response('missing', { status: 404 })), /HTTP 404/);
  await assert.rejects(checkTwaReadiness(config, async () => { throw new Error('redirect blocked'); }), /without redirects/);
});