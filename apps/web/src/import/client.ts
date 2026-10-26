import type { LinkPreviewResponse } from '@purrroute/contracts';

export class LinkPreviewClientError extends Error {
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
  if (!response.ok) throw new LinkPreviewClientError(response.status, 'link_preview_unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('csrfToken' in body) || typeof body.csrfToken !== 'string') {
    throw new LinkPreviewClientError(503, 'link_preview_unavailable');
  }
  return body.csrfToken;
}

export async function previewLink(url: string): Promise<LinkPreviewResponse> {
  const token = await csrfToken();
  const response = await fetch('/api/import/link-preview', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    let code = response.status === 429 ? 'link_preview_rate_limited' : 'link_preview_unavailable';
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === 'string') code = body.error;
    } catch { }
    throw new LinkPreviewClientError(response.status, code);
  }
  return response.json() as Promise<LinkPreviewResponse>;
}