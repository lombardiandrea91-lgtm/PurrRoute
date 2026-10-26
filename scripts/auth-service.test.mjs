import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService, DevelopmentMailSink } from '../apps/api/src/auth/auth-service.ts';

class InMemoryAuthRepository {
  accounts = new Map();
  tokens = new Map();
  sessions = new Map();

  constructor(now) {
    this.now = now;
  }

  async registerAccount(input) {
    if ([...this.accounts.values()].some((account) => account.email === input.email)) return false;
    const timestamp = this.now().toISOString();
    this.accounts.set(input.id, {
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      emailVerifiedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.tokens.set(input.tokenHash.toString('hex'), {
      userId: input.id,
      purpose: 'email_verification',
      expiresAt: input.tokenExpiresAt,
      consumed: false,
    });
    return true;
  }

  async findAccountByEmail(email) {
    return [...this.accounts.values()].find((account) => account.email === email) ?? null;
  }

  async findAccountById(id) {
    return this.accounts.get(id) ?? null;
  }

  async issueTokenForEmail(email, purpose, tokenHash, expiresAt) {
    const account = await this.findAccountByEmail(email);
    if (!account || (purpose === 'email_verification' && account.emailVerifiedAt)) return false;
    for (const token of this.tokens.values()) {
      if (token.userId === account.id && token.purpose === purpose) token.consumed = true;
    }
    this.tokens.set(tokenHash.toString('hex'), {
      userId: account.id,
      purpose,
      expiresAt,
      consumed: false,
    });
    return true;
  }

  async consumeVerificationToken(tokenHash) {
    const token = this.consumeToken(tokenHash, 'email_verification');
    if (!token) return false;
    const account = this.accounts.get(token.userId);
    account.emailVerifiedAt = this.now().toISOString();
    return true;
  }

  async consumePasswordResetToken(tokenHash, passwordHash) {
    const token = this.consumeToken(tokenHash, 'password_reset');
    if (!token) return false;
    const account = this.accounts.get(token.userId);
    account.passwordHash = passwordHash;
    account.updatedAt = this.now().toISOString();
    for (const session of this.sessions.values()) {
      if (session.userId === account.id) session.revoked = true;
    }
    return true;
  }

  consumeToken(tokenHash, purpose) {
    const token = this.tokens.get(tokenHash.toString('hex'));
    if (!token || token.purpose !== purpose || token.consumed || token.expiresAt <= this.now()) return null;
    token.consumed = true;
    return token;
  }

  async createSession(input) {
    this.sessions.set(input.sessionHash.toString('hex'), {
      userId: input.userId,
      expiresAt: input.expiresAt,
      revoked: false,
    });
  }

  async findSession(sessionHash) {
    const session = this.sessions.get(sessionHash.toString('hex'));
    const account = session && this.accounts.get(session.userId);
    if (!account || session.revoked || session.expiresAt <= this.now() || !account.emailVerifiedAt) return null;
    const { passwordHash, ...publicData } = account;
    return { ...publicData, expiresAt: session.expiresAt.toISOString() };
  }

  async revokeSession(sessionHash) {
    const session = this.sessions.get(sessionHash.toString('hex'));
    if (session) session.revoked = true;
  }

  async exportAccount(userId, exportedAt) {
    const account = this.accounts.get(userId);
    if (!account) return null;
    return { exportVersion: 1, exportedAt, email: account.email };
  }

  async deleteAccount(userId) {
    this.accounts.delete(userId);
    for (const session of this.sessions.values()) {
      if (session.userId === userId) session.revoked = true;
    }
    return true;
  }
}

test('registrazione, verifica monouso e login non espongono hash o token di sessione', async () => {
  const now = () => new Date('2026-10-26T12:00:00.000Z');
  const repository = new InMemoryAuthRepository(now);
  const mailer = new DevelopmentMailSink();
  const service = new AuthService(repository, mailer, now);

  assert.deepEqual(await service.register('  Gatto@Example.test ', 'correct-horse-battery'), { accepted: true });
  assert.deepEqual(await service.register('gatto@example.test', 'another-long-password'), { accepted: true });
  assert.equal(repository.accounts.size, 1);
  assert.equal(mailer.messages().length, 1);
  assert.equal(mailer.messages()[0].email, 'gatto@example.test');
  assert.equal(repository.accounts.values().next().value.passwordHash.startsWith('$argon2id$'), true);
  assert.equal(await service.login('gatto@example.test', 'correct-horse-battery').catch((error) => error.code), 'email_not_verified');

  const verificationToken = mailer.messages()[0].token;
  assert.equal(await service.verifyEmail('malformed'), false);
  assert.equal(await service.verifyEmail(verificationToken), true);
  assert.equal(await service.verifyEmail(verificationToken), false);

  const login = await service.login('GATTO@example.test', 'correct-horse-battery');
  assert.equal(login.account.email, 'gatto@example.test');
  assert.equal('passwordHash' in login.account, false);
  assert.equal(repository.sessions.has(login.sessionToken), false);
  assert.equal((await service.authenticate(login.sessionToken)).account.id, login.account.id);
  await service.logout(login.sessionToken);
  assert.equal(await service.authenticate(login.sessionToken), null);
});

test('reset password revoca sessioni; export e cancellazione richiedono l’account corretto', async () => {
  const now = () => new Date('2026-10-26T12:00:00.000Z');
  const repository = new InMemoryAuthRepository(now);
  const mailer = new DevelopmentMailSink();
  const service = new AuthService(repository, mailer, now);

  await service.register('viaggio@example.test', 'initial-password-long');
  await service.verifyEmail(mailer.messages()[0].token);
  const firstLogin = await service.login('viaggio@example.test', 'initial-password-long');

  assert.deepEqual(await service.requestPasswordReset('missing@example.test'), { accepted: true });
  assert.deepEqual(await service.requestPasswordReset('VIAGGIO@example.test'), { accepted: true });
  const resetToken = mailer.messages()[1].token;
  assert.equal(await service.resetPassword('invalid-token', 'replacement-password'), false);
  assert.equal(await service.resetPassword(resetToken, 'replacement-password'), true);
  assert.equal(await service.resetPassword(resetToken, 'another-password'), false);
  assert.equal(await service.authenticate(firstLogin.sessionToken), null);
  assert.equal(await service.login('viaggio@example.test', 'initial-password-long').catch((error) => error.code), 'invalid_credentials');

  const newLogin = await service.login('viaggio@example.test', 'replacement-password');
  const exported = await service.exportAccount(newLogin.account.id);
  assert.equal(exported.email, 'viaggio@example.test');
  assert.equal('passwordHash' in exported, false);
  assert.equal(await service.deleteAccount(newLogin.account.id, 'wrong-password').catch((error) => error.code), 'invalid_password');
  assert.equal(await service.deleteAccount(newLogin.account.id, 'replacement-password'), true);
  assert.equal(await service.authenticate(newLogin.sessionToken), null);
});