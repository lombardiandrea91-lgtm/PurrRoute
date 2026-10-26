import type { NearbyExploreRequest, NearbyExploreResponse } from '@purrroute/contracts';

export class ExploreClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function csrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new ExploreClientError(response.status, 'explore_unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('csrfToken' in body) || typeof body.csrfToken !== 'string') {
    throw new ExploreClientError(503, 'explore_unavailable');
  }
  return body.csrfToken;
}

export async function searchNearbyPlaces(request: NearbyExploreRequest): Promise<NearbyExploreResponse> {
  const token = await csrfToken();
  const response = await fetch('/api/explore/nearby', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    let code = response.status === 429 ? 'explore_rate_limited' : 'explore_unavailable';
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === 'string') code = body.error;
    } catch { }
    throw new ExploreClientError(response.status, code);
  }
  return response.json() as Promise<NearbyExploreResponse>;
}