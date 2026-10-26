import type { SyncTripRequest, SyncTripResponse } from '@purrroute/contracts';

export class SyncClientError extends Error {
  readonly status: number;
  readonly current: SyncTripResponse | null;

  constructor(status: number, code: string, current: SyncTripResponse | null = null) {
    super(code);
    this.status = status;
    this.current = current;
  }
}

async function csrfToken(signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new SyncClientError(response.status, 'sync_unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('csrfToken' in body) || typeof body.csrfToken !== 'string') {
    throw new SyncClientError(503, 'sync_unavailable');
  }
  return body.csrfToken;
}

export async function getSyncedTrip(tripId: string, signal?: AbortSignal): Promise<SyncTripResponse> {
  const response = await fetch(`/api/sync/trips/${encodeURIComponent(tripId)}`, {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new SyncClientError(response.status, 'sync_unavailable');
  return response.json() as Promise<SyncTripResponse>;
}

export async function pushSyncedTrip(
  request: SyncTripRequest,
  signal?: AbortSignal,
): Promise<SyncTripResponse> {
  const token = await csrfToken(signal);
  const response = await fetch('/api/sync/trips', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(request),
    ...(signal ? { signal } : {}),
  });
  if (response.status === 409) {
    const body = await response.json() as { current?: SyncTripResponse | null };
    throw new SyncClientError(409, 'sync_conflict', body.current ?? null);
  }
  if (!response.ok) throw new SyncClientError(response.status, 'sync_unavailable');
  return response.json() as Promise<SyncTripResponse>;
}

export async function listSyncedTrips(signal?: AbortSignal): Promise<SyncTripResponse[]> {
  const response = await fetch('/api/sync/trips', {
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new SyncClientError(response.status, 'sync_unavailable');
  return response.json() as Promise<SyncTripResponse[]>;
}