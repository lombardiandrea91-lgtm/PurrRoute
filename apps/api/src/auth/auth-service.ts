import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { AuthRepository, PublicAccount } from './repository.ts';

export type AuthMailPurpose = 'email_verification' | 'password_reset';

export interface AuthMailMessage {
  purpose: AuthMailPurpose;
  email: string;
  token: string;
}

export interface AuthMailer {
  send(message: AuthMailMessage): Promise<void>;
}

export interface AuthenticatedAccount {
  account: PublicAccount;
  expiresAt: string;
}

export class AuthError extends Error {
  readonly code: 'invalid_credentials' | 'email_not_verified' | 'invalid_token' | 'invalid_password';
  readonly statusCode: number;

  constructor(
    code: 'invalid_credentials' | 'email_not_verified' | 'invalid_token' | 'invalid_password',
    statusCode: number,
  ) {
    super(code);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makeOpaqueToken(): { token: string; hash: Buffer } {
  const bytes = randomBytes(32);
  return { token: bytes.toString('base64url'), hash: createHash('sha256').update(bytes).digest() };
}

function hashOpaqueToken(token: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const decoded = Buffer.from(token, 'base64url');
  if (decoded.length !== 32 || decoded.toString('base64url') !== token) return null;
  return createHash('sha256').update(decoded).digest();
}

function publicAccount(account: {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    emailVerifiedAt: account.emailVerifiedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export class AuthService {
  private dummyPasswordHash: Promise<string> | undefined;
  private readonly repository: AuthRepository;
  private readonly mailer: AuthMailer;
  private readonly now: () => Date;

  constructor(
    repository: AuthRepository,
    mailer: AuthMailer,
    now: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.mailer = mailer;
    this.now = now;
  }

  async register(emailInput: string, password: string): Promise<{ accepted: true }> {
    const email = normalizeEmail(emailInput);
    const verificationToken = makeOpaqueToken();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const created = await this.repository.registerAccount({
      id: randomUUID(),
      email,
      passwordHash,
      tokenHash: verificationToken.hash,
      tokenExpiresAt: new Date(this.now().getTime() + 24 * 60 * 60 * 1000),
    });

    if (created) {
      await this.mailer.send({ purpose: 'email_verification', email, token: verificationToken.token });
    }
    return { accepted: true };
  }

  async requestEmailVerification(emailInput: string): Promise<{ accepted: true }> {
    const email = normalizeEmail(emailInput);
    const token = makeOpaqueToken();
    const issued = await this.repository.issueTokenForEmail(
      email,
      'email_verification',
      token.hash,
      new Date(this.now().getTime() + 24 * 60 * 60 * 1000),
    );
    if (issued) await this.mailer.send({ purpose: 'email_verification', email, token: token.token });
    return { accepted: true };
  }

  async verifyEmail(token: string): Promise<boolean> {
    const tokenHash = hashOpaqueToken(token);
    if (!tokenHash) return false;
    return this.repository.consumeVerificationToken(tokenHash);
  }

  async login(emailInput: string, password: string): Promise<{
    account: PublicAccount;
    sessionToken: string;
    expiresAt: string;
  }> {
    const account = await this.repository.findAccountByEmail(normalizeEmail(emailInput));
    const dummyHash = this.dummyPasswordHash ??= argon2.hash(
      randomBytes(32).toString('base64url'),
      { type: argon2.argon2id },
    );
    const passwordMatches = await argon2.verify(account?.passwordHash ?? await dummyHash, password)
      .catch(() => false);

    if (!account || !passwordMatches) throw new AuthError('invalid_credentials', 401);
    if (!account.emailVerifiedAt) throw new AuthError('email_not_verified', 403);

    const sessionToken = makeOpaqueToken();
    const expiresAt = new Date(this.now().getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.repository.createSession({
      sessionHash: sessionToken.hash,
      userId: account.id,
      expiresAt,
    });

    return {
      account: publicAccount(account),
      sessionToken: sessionToken.token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async requestPasswordReset(emailInput: string): Promise<{ accepted: true }> {
    const email = normalizeEmail(emailInput);
    const token = makeOpaqueToken();
    const issued = await this.repository.issueTokenForEmail(
      email,
      'password_reset',
      token.hash,
      new Date(this.now().getTime() + 60 * 60 * 1000),
    );
    if (issued) await this.mailer.send({ purpose: 'password_reset', email, token: token.token });
    return { accepted: true };
  }

  async resetPassword(token: string, password: string): Promise<boolean> {
    const tokenHash = hashOpaqueToken(token);
    if (!tokenHash) return false;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return this.repository.consumePasswordResetToken(tokenHash, passwordHash);
  }

  async authenticate(sessionToken: string | undefined): Promise<AuthenticatedAccount | null> {
    if (!sessionToken) return null;
    const sessionHash = hashOpaqueToken(sessionToken);
    if (!sessionHash) return null;
    const session = await this.repository.findSession(sessionHash);
    if (!session) return null;
    const { expiresAt, ...account } = session;
    return { account, expiresAt };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    const sessionHash = hashOpaqueToken(sessionToken);
    if (sessionHash) await this.repository.revokeSession(sessionHash);
  }

  exportAccount(userId: string): Promise<Record<string, unknown> | null> {
    return this.repository.exportAccount(userId, this.now().toISOString());
  }

  async deleteAccount(userId: string, password: string): Promise<boolean> {
    const account = await this.repository.findAccountById(userId);
    if (!account) return false;
    const passwordMatches = await argon2.verify(account.passwordHash, password).catch(() => false);
    if (!passwordMatches) throw new AuthError('invalid_password', 403);
    return this.repository.deleteAccount(userId);
  }
}

export class DevelopmentMailSink implements AuthMailer {
  private readonly queued: Array<AuthMailMessage & { queuedAt: string }> = [];

  async send(message: AuthMailMessage): Promise<void> {
    this.queued.push({ ...message, queuedAt: new Date().toISOString() });
  }

  messages(): Array<AuthMailMessage & { queuedAt: string }> {
    return this.queued.map((message) => ({ ...message }));
  }
}