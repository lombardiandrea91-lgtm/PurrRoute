import { checkTwaReadiness } from './twa-readiness.mjs';

try {
  const result = await checkTwaReadiness({
    origin: process.env.TWA_ORIGIN,
    applicationId: process.env.TWA_APPLICATION_ID,
    certificateFingerprint: process.env.TWA_SHA256_CERT_FINGERPRINT,
  });
  console.log(`TWA readiness passed for ${result.origin} (${result.applicationId}).`);
} catch (error) {
  console.error(`TWA readiness blocked: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
}