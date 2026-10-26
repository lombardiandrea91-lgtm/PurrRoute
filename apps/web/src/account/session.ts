export interface AccountSession {
  account: {
    id: string;
    email: string;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  expiresAt: string;
}

export class AccountRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

let currentSession: AccountSession | null = null;
const listeners = new Set<() => void>();

export function subscribeAccountSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccountSession(): AccountSession | null {
  return currentSession;
}

function setAccountSession(value: AccountSession | null): void {
  currentSession = value;
  listeners.forEach((listener) => listener());
}

async function csrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new AccountRequestError(response.status, 'account_unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('csrfToken' in body) || typeof body.csrfToken !== 'string') {
    throw new AccountRequestError(503, 'account_unavailable');
  }
  return body.csrfToken;
}

async function post(path: string, body?: unknown): Promise<Response> {
  const token = await csrfToken();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: body === undefined ? '{}' : JSON.stringify(body),
  });
  if (!response.ok) {
    let code = 'account_unavailable';
    try {
      const data = await response.json() as { error?: unknown };
      if (typeof data.error === 'string') code = data.error;
    } catch { }
    throw new AccountRequestError(response.status, code);
  }
  return response;
}

export async function refreshAccountSession(): Promise<AccountSession | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (response.status === 401) {
    setAccountSession(null);
    return null;
  }
  if (!response.ok) throw new AccountRequestError(response.status, 'account_unavailable');
  const session = await response.json() as AccountSession;
  setAccountSession(session);
  return session;
}

export async function registerAccount(email: string, password: string): Promise<void> {
  await post('/api/auth/register', { email, password });
}

export async function verifyAccountEmail(token: string): Promise<void> {
  await post('/api/auth/verify-email', { token });
}

export async function loginAccount(email: string, password: string): Promise<AccountSession> {
  const response = await post('/api/auth/login', { email, password });
  const session = await response.json() as AccountSession;
  setAccountSession(session);
  return session;
}

export async function logoutAccount(): Promise<void> {
  await post('/api/auth/logout');
  setAccountSession(null);
}

export async function developmentVerificationToken(email: string): Promise<string | null> {
  const response = await fetch('/api/dev/mail', { credentials: 'same-origin' });
  if (!response.ok) return null;
  const body = await response.json() as { messages?: Array<{ purpose?: string; email?: string; token?: string }> };
  const matching = body.messages?.filter((message) => message.purpose === 'email_verification'
    && message.email?.toLowerCase() === email.trim().toLowerCase()).at(-1);
  return typeof matching?.token === 'string' ? matching.token : null;
}