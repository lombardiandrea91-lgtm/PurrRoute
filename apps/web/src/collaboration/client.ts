import type {
  AddTripCollaboratorRequest,
  TripCollaborator,
  TripCollaboratorsResponse,
} from '@purrroute/contracts';

export class CollaborationClientError extends Error {
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
  if (!response.ok) throw new CollaborationClientError(response.status, 'collaboration_unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('csrfToken' in body) || typeof body.csrfToken !== 'string') {
    throw new CollaborationClientError(503, 'collaboration_unavailable');
  }
  return body.csrfToken;
}

async function readError(response: Response): Promise<CollaborationClientError> {
  let code = 'collaboration_unavailable';
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === 'string') code = body.error;
  } catch { }
  return new CollaborationClientError(response.status, code);
}

export async function getTripCollaborators(tripId: string): Promise<TripCollaboratorsResponse> {
  const response = await fetch(`/api/collaboration/trips/${encodeURIComponent(tripId)}/members`, {
    credentials: 'same-origin',
  });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<TripCollaboratorsResponse>;
}

export async function addTripCollaborator(
  tripId: string,
  request: AddTripCollaboratorRequest,
): Promise<TripCollaborator> {
  const token = await csrfToken();
  const response = await fetch(`/api/collaboration/trips/${encodeURIComponent(tripId)}/members`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<TripCollaborator>;
}

export async function removeTripCollaborator(tripId: string, memberId: string): Promise<void> {
  const token = await csrfToken();
  const response = await fetch(
    `/api/collaboration/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': token },
    },
  );
  if (!response.ok) throw await readError(response);
}