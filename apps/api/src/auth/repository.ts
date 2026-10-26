export type AccountTokenPurpose = 'email_verification' | 'password_reset';

export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicAccount = Omit<AccountRecord, 'passwordHash'>;

export interface RegisterAccountInput {
  id: string;
  email: string;
  passwordHash: string;
  tokenHash: Buffer;
  tokenExpiresAt: Date;
}

export interface SessionInput {
  sessionHash: Buffer;
  userId: string;
  expiresAt: Date;
}

export interface AuthRepository {
  registerAccount(input: RegisterAccountInput): Promise<boolean>;
  findAccountByEmail(email: string): Promise<AccountRecord | null>;
  findAccountById(id: string): Promise<AccountRecord | null>;
  issueTokenForEmail(
    email: string,
    purpose: AccountTokenPurpose,
    tokenHash: Buffer,
    expiresAt: Date,
  ): Promise<boolean>;
  consumeVerificationToken(tokenHash: Buffer): Promise<boolean>;
  consumePasswordResetToken(tokenHash: Buffer, passwordHash: string): Promise<boolean>;
  createSession(input: SessionInput): Promise<void>;
  findSession(sessionHash: Buffer): Promise<(PublicAccount & { expiresAt: string }) | null>;
  revokeSession(sessionHash: Buffer): Promise<void>;
  exportAccount(userId: string, exportedAt: string): Promise<Record<string, unknown> | null>;
  deleteAccount(userId: string): Promise<boolean>;
}