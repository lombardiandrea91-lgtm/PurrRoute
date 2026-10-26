import { isIP } from 'node:net';

const androidPackagePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const fingerprintPattern = /^(?:[0-9a-f]{2}:){31}[0-9a-f]{2}$/i;
const permittedDisplays = new Set(['standalone', 'fullscreen', 'minimal-ui']);
const requiredIconSizes = ['192x192', '512x512'];

export class TwaReadinessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwaReadinessError';
  }
}

export function validateTwaInputs({ origin: originInput, applicationId, certificateFingerprint }) {
  let origin;
  try {
    origin = new URL(originInput);
  } catch {
    throw new TwaReadinessError('TWA_ORIGIN must be an HTTPS origin.');
  }
  const hostname = origin.hostname.toLowerCase();
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash
    || origin.username || origin.password || hostname === 'localhost' || hostname.endsWith('.localhost')
    || hostname.endsWith('.local') || isIP(hostname)) {
    throw new TwaReadinessError('TWA_ORIGIN must be a public HTTPS origin without a path.');
  }
  if (typeof applicationId !== 'string' || !androidPackagePattern.test(applicationId)) {
    throw new TwaReadinessError('TWA_APPLICATION_ID must be a valid lowercase Android package ID.');
  }
  if (typeof certificateFingerprint !== 'string' || !fingerprintPattern.test(certificateFingerprint)) {
    throw new TwaReadinessError('TWA_SHA256_CERT_FINGERPRINT must contain 32 colon-separated SHA-256 bytes.');
  }
  return {
    origin: origin.origin,
    applicationId,
    certificateFingerprint: certificateFingerprint.toUpperCase(),
  };
}

export function validateWebManifest(manifest, originInput) {
  const origin = new URL(originInput);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new TwaReadinessError('The published Web Manifest must be a JSON object.');
  }
  if (!permittedDisplays.has(manifest.display)) {
    throw new TwaReadinessError('Web Manifest display must be standalone, fullscreen, or minimal-ui.');
  }
  if (typeof manifest.start_url !== 'string') {
    throw new TwaReadinessError('Web Manifest must define start_url.');
  }
  let startUrl;
  let scopeUrl;
  try {
    startUrl = new URL(manifest.start_url, origin);
    scopeUrl = new URL(typeof manifest.scope === 'string' ? manifest.scope : './', origin);
  } catch {
    throw new TwaReadinessError('Web Manifest start_url and scope must be valid URLs.');
  }
  if (startUrl.origin !== origin.origin || scopeUrl.origin !== origin.origin
    || !isPathInScope(startUrl.pathname, scopeUrl.pathname)) {
    throw new TwaReadinessError('Web Manifest start_url and scope must stay inside TWA_ORIGIN.');
  }
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  for (const size of requiredIconSizes) {
    if (!icons.some((icon) => icon?.sizes?.split(/\s+/).includes(size)
      && icon.type === 'image/png' && typeof icon.src === 'string'
      && isSameOriginUrl(icon.src, origin))) {
      throw new TwaReadinessError(`Web Manifest needs a same-origin PNG icon of size ${size}.`);
    }
  }
  return manifest;
}

function isPathInScope(pathname, scopePath) {
  const normalizedScope = scopePath.endsWith('/') ? scopePath : `${scopePath}/`;
  return pathname === scopePath || pathname.startsWith(normalizedScope);
}

function isSameOriginUrl(value, origin) {
  try {
    return new URL(value, origin).origin === origin.origin;
  } catch {
    return false;
  }
}

export function validateAssetLinks(statements, applicationId, certificateFingerprint) {
  if (!Array.isArray(statements)) {
    throw new TwaReadinessError('assetlinks.json must contain a JSON array.');
  }
  const normalizedFingerprint = certificateFingerprint.replaceAll(':', '').toUpperCase();
  const isMatchingStatement = statements.some((statement) => {
    const target = statement?.target;
    return Array.isArray(statement?.relation)
      && statement.relation.includes('delegate_permission/common.handle_all_urls')
      && target?.namespace === 'android_app'
      && target.package_name === applicationId
      && Array.isArray(target.sha256_cert_fingerprints)
      && target.sha256_cert_fingerprints.some((fingerprint) =>
        typeof fingerprint === 'string'
        && fingerprint.replaceAll(':', '').toUpperCase() === normalizedFingerprint);
  });
  if (!isMatchingStatement) {
    throw new TwaReadinessError('assetlinks.json does not delegate URL handling to the configured app and signing certificate.');
  }
  return statements;
}

async function readJson(fetcher, url, label) {
  let response;
  try {
    response = await fetcher(url, {
      redirect: 'error',
      headers: { accept: 'application/manifest+json, application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TwaReadinessError(`Could not fetch ${label} from the HTTPS origin without redirects.`);
  }
  if (!response.ok) throw new TwaReadinessError(`${label} returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new TwaReadinessError(`${label} did not return valid JSON.`);
  }
}

export async function checkTwaReadiness(inputs, fetcher = fetch) {
  const config = validateTwaInputs(inputs);
  const [manifest, assetLinks] = await Promise.all([
    readJson(fetcher, new URL('/manifest.webmanifest', config.origin), 'Web Manifest'),
    readJson(fetcher, new URL('/.well-known/assetlinks.json', config.origin), 'Digital Asset Links'),
  ]);
  validateWebManifest(manifest, config.origin);
  validateAssetLinks(assetLinks, config.applicationId, config.certificateFingerprint);
  return { origin: config.origin, applicationId: config.applicationId };
}