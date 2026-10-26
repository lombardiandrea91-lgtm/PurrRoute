import cookie from '@fastify/cookie';
import csrfProtection from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import Type from 'typebox';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type preHandlerHookHandler,
} from 'fastify';
import {
  AcceptedResponseSchema,
  ApiErrorSchema,
  AuthenticatedAccountSchema,
  CsrfTokenResponseSchema,
  DeleteAccountRequestSchema,
  EmailRequestSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  PasswordResetRequestSchema,
  RegisterRequestSchema,
  SyncConflictSchema,
  SyncTripListSchema,
  SyncTripRequestSchema,
  SyncTripResponseSchema,
  TokenRequestSchema,
} from '@purrroute/contracts';
import type { AuthService, DevelopmentMailSink } from './auth/auth-service.ts';
import { AuthError } from './auth/auth-service.ts';
import type {
  DeleteAccountRequest,
  EmailRequest,
  LoginRequest,
  PasswordResetRequest,
  RegisterRequest,
  SyncTripRequest,
  SyncTripResponse,
  TokenRequest,
} from '@purrroute/contracts';
import { registerMapRoutes } from './maps/routes.ts';
import type { MapServices } from './maps/routes.ts';
import { OpenFreeMapTiles, registerOpenFreeMapTileRoutes } from './maps/openfreemap-tiles.ts';
import { SyncPayloadError } from './sync/postgres-sync-repository.ts';
import type { SyncPushResult } from './sync/postgres-sync-repository.ts';
import { registerExploreRoutes } from './explore/routes.ts';
import type { ExploreServices } from './explore/routes.ts';
import { registerLinkImportRoutes } from './import/routes.ts';
import type { LinkImportService } from './import/routes.ts';

type AuthRoutes = Pick<
  AuthService,
  | 'register'
  | 'requestEmailVerification'
  | 'verifyEmail'
  | 'login'
  | 'requestPasswordReset'
  | 'resetPassword'
  | 'authenticate'
  | 'logout'
  | 'exportAccount'
  | 'deleteAccount'
>;

export interface BuildServerOptions {
  auth?: AuthRoutes;
  maps?: MapServices;
  tiles?: OpenFreeMapTiles;
  sync?: SyncRoutes;
  explore?: ExploreServices;
  linkImport?: LinkImportService;
  mailSink?: DevelopmentMailSink;
  production?: boolean;
  webOrigin?: string;
}

export interface SyncRoutes {
  listTrips(userId: string): Promise<SyncTripResponse[]>;
  getTrip(userId: string, tripId: string): Promise<SyncTripResponse | null>;
  pushTrip(userId: string, request: SyncTripRequest): Promise<SyncPushResult>;
}

function isLoopbackAddress(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function addSyncRoutes(
  app: FastifyInstance,
  auth: AuthRoutes,
  sync: SyncRoutes,
  production: boolean,
): void {
  const sessionCookieName = production ? '__Host-purrroute_session' : 'purrroute_session';
  const csrfGuard: preHandlerHookHandler = (request, reply, done) => {
    app.csrfProtection(request, reply, done);
  };
  const authenticate = (request: FastifyRequest) => auth.authenticate(request.cookies[sessionCookieName]);

  app.get('/api/sync/trips', {
    schema: { response: { 200: SyncTripListSchema, 401: ApiErrorSchema } },
  }, async (request, reply) => {
    const session = await authenticate(request);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    return sync.listTrips(session.account.id);
  });

  app.get<{ Params: { tripId: string } }>('/api/sync/trips/:tripId', {
    schema: {
      params: Type.Object({ tripId: Type.String({ format: 'uuid' }) }, { additionalProperties: false }),
      response: { 200: SyncTripResponseSchema, 401: ApiErrorSchema, 404: ApiErrorSchema },
    },
  }, async (request, reply) => {
    const session = await authenticate(request);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    const snapshot = await sync.getTrip(session.account.id, request.params.tripId);
    if (!snapshot) return reply.code(404).send({ error: 'trip_not_found' });
    return snapshot;
  });

  app.post<{ Body: SyncTripRequest }>('/api/sync/trips', {
    schema: {
      body: SyncTripRequestSchema,
      response: {
        200: SyncTripResponseSchema,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        409: SyncConflictSchema,
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    const session = await authenticate(request);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    try {
      const result = await sync.pushTrip(session.account.id, request.body);
      if (result.kind === 'not_found') return reply.code(404).send({ error: 'trip_not_found' });
      if (result.kind === 'conflict') {
        return reply.code(409).send({ error: 'sync_conflict', current: result.current });
      }
      return result.snapshot;
    } catch (error) {
      if (error instanceof SyncPayloadError) return reply.code(400).send({ error: 'invalid_sync_payload' });
      throw error;
    }
  });
}

function addAuthRoutes(
  app: FastifyInstance,
  auth: AuthRoutes,
  production: boolean,
  mailSink?: DevelopmentMailSink,
): void {
  const sessionCookieName = production ? '__Host-purrroute_session' : 'purrroute_session';
  const csrfGuard: preHandlerHookHandler = (request, reply, done) => {
    app.csrfProtection(request, reply, done);
  };
  const readSessionToken = (request: FastifyRequest) => request.cookies[sessionCookieName];
  const setSessionCookie = (reply: FastifyReply, token: string, expiresAt: string) => {
    reply.setCookie(sessionCookieName, token, {
      expires: new Date(expiresAt),
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: production,
    });
  };
  const clearSessionCookie = (reply: FastifyReply) => {
    reply.clearCookie(sessionCookieName, {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: production,
    });
  };

  app.post<{ Body: RegisterRequest }>('/api/auth/register', {
    schema: { body: RegisterRequestSchema, response: { 202: AcceptedResponseSchema } },
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: csrfGuard,
  }, async (request, reply) => reply.code(202).send(await auth.register(request.body.email, request.body.password)));

  app.post<{ Body: EmailRequest }>('/api/auth/verification/request', {
    schema: { body: EmailRequestSchema, response: { 202: AcceptedResponseSchema } },
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: csrfGuard,
  }, async (request, reply) => reply.code(202).send(await auth.requestEmailVerification(request.body.email)));

  app.post<{ Body: TokenRequest }>('/api/auth/verify-email', {
    schema: { body: TokenRequestSchema },
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    if (!await auth.verifyEmail(request.body.token)) return reply.code(400).send({ error: 'invalid_or_expired_token' });
    return reply.code(204).send();
  });

  app.post<{ Body: LoginRequest }>('/api/auth/login', {
    schema: { body: LoginRequestSchema, response: { 200: LoginResponseSchema } },
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    const login = await auth.login(request.body.email, request.body.password);
    setSessionCookie(reply, login.sessionToken, login.expiresAt);
    return { account: login.account, expiresAt: login.expiresAt };
  });

  app.post<{ Body: EmailRequest }>('/api/auth/password/request', {
    schema: { body: EmailRequestSchema, response: { 202: AcceptedResponseSchema } },
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: csrfGuard,
  }, async (request, reply) => reply.code(202).send(await auth.requestPasswordReset(request.body.email)));

  app.post<{ Body: PasswordResetRequest }>('/api/auth/password/reset', {
    schema: { body: PasswordResetRequestSchema },
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    if (!await auth.resetPassword(request.body.token, request.body.password)) {
      return reply.code(400).send({ error: 'invalid_or_expired_token' });
    }
    return reply.code(204).send();
  });

  app.get('/api/auth/me', {
    schema: { response: { 200: AuthenticatedAccountSchema, 401: ApiErrorSchema } },
  }, async (request, reply) => {
    const session = await auth.authenticate(readSessionToken(request));
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    return session;
  });

  app.post('/api/auth/logout', { preHandler: csrfGuard }, async (request, reply) => {
    await auth.logout(readSessionToken(request));
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/api/account/export', async (request, reply) => {
    const session = await auth.authenticate(readSessionToken(request));
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    const exported = await auth.exportAccount(session.account.id);
    if (!exported) return reply.code(404).send({ error: 'account_not_found' });
    return exported;
  });

  app.delete<{ Body: DeleteAccountRequest }>('/api/account', {
    schema: { body: DeleteAccountRequestSchema },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    const sessionToken = readSessionToken(request);
    const session = await auth.authenticate(sessionToken);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    const deleted = await auth.deleteAccount(session.account.id, request.body.password);
    if (!deleted) return reply.code(404).send({ error: 'account_not_found' });
    await auth.logout(sessionToken);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  if (!production && mailSink) {
    app.get('/api/dev/mail', async (request, reply) => {
      if (!isLoopbackAddress(request.ip)) return reply.code(404).send({ error: 'not_found' });
      return { messages: mailSink.messages() };
    });
  }
}

export function buildServer(options: BuildServerOptions = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const webOrigin = options.webOrigin ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  const app = Fastify({ logger: false });

  app.register(cookie);
  app.register(csrfProtection, {
    cookieKey: production ? '__Host-purrroute_csrf' : '_csrf',
    cookieOpts: {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: production,
    },
    getToken: (request) => {
      const token = request.headers['x-csrf-token'];
      return typeof token === 'string' ? token : undefined;
    },
  });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || !request.url.startsWith('/api/')) return;
    if (request.headers.origin !== webOrigin) {
      return reply.code(403).send({ error: 'origin_not_allowed' });
    }
  });
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    return payload;
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthError) return reply.code(error.statusCode).send({ error: error.code });
    if (typeof error === 'object' && error !== null
      && 'code' in error && error.code === 'FST_CSRF_INVALID_TOKEN') {
      return reply.code(403).send({ error: 'csrf_invalid' });
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited' });
    }
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply.code(400).send({ error: 'invalid_request' });
    }
    return reply.code(500).send({ error: 'internal_error' });
  });

  app.get('/health', {
    schema: { response: { 200: HealthResponseSchema } },
  }, async () => ({ status: 'ok' as const }));

  app.get('/api/auth/csrf', {
    schema: { response: { 200: CsrfTokenResponseSchema } },
  }, async (_request, reply) => ({
    csrfToken: await reply.generateCsrf(),
  }));

  if (options.auth) addAuthRoutes(app, options.auth, production, options.mailSink);
  if (options.auth && options.sync) addSyncRoutes(app, options.auth, options.sync, production);
  registerMapRoutes(app, options.maps);
  registerOpenFreeMapTileRoutes(app, options.tiles);
  registerExploreRoutes(app, options.explore);
  if (options.linkImport) {
    app.register(async (importer) => registerLinkImportRoutes(importer, options.linkImport));
  }

  return app;
}