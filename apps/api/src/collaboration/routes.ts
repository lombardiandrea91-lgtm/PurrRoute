import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import Type from 'typebox';
import {
  AddTripCollaboratorRequestSchema,
  ApiErrorSchema,
  TripCollaboratorsResponseSchema,
  TripCollaboratorSchema,
} from '@purrroute/contracts';
import type { AddTripCollaboratorRequest, TripCollaborator } from '@purrroute/contracts';

interface CollaborationAuth {
  authenticate(token: string | undefined): Promise<{ account: { id: string } } | null>;
}

export interface TripCollaborationService {
  listMembers(ownerId: string, tripId: string): Promise<TripCollaborator[] | null>;
  addMember(ownerId: string, tripId: string, email: string, role: 'editor' | 'viewer'): Promise<TripCollaborator | null>;
  removeMember(ownerId: string, tripId: string, memberId: string): Promise<boolean>;
}

export function registerTripCollaborationRoutes(
  app: FastifyInstance,
  auth: CollaborationAuth,
  collaboration: TripCollaborationService,
  production: boolean,
): void {
  const sessionCookieName = production ? '__Host-purrroute_session' : 'purrroute_session';
  const csrfGuard: preHandlerHookHandler = (request, reply, done) => {
    app.csrfProtection(request, reply, done);
  };
  const authenticate = (request: { cookies: Record<string, string | undefined> }) =>
    auth.authenticate(request.cookies[sessionCookieName]);
  const params = Type.Object({ tripId: Type.String({ format: 'uuid' }) }, { additionalProperties: false });

  app.get<{ Params: { tripId: string } }>('/api/collaboration/trips/:tripId/members', {
    schema: {
      params,
      response: { 200: TripCollaboratorsResponseSchema, 401: ApiErrorSchema, 404: ApiErrorSchema },
    },
  }, async (request, reply) => {
    const session = await authenticate(request);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    const members = await collaboration.listMembers(session.account.id, request.params.tripId);
    if (!members) return reply.code(404).send({ error: 'trip_not_found' });
    return { members };
  });

  app.post<{ Params: { tripId: string }; Body: AddTripCollaboratorRequest }>(
    '/api/collaboration/trips/:tripId/members', {
      schema: {
        params,
        body: AddTripCollaboratorRequestSchema,
        response: { 200: TripCollaboratorSchema, 400: ApiErrorSchema, 401: ApiErrorSchema, 404: ApiErrorSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: csrfGuard,
    }, async (request, reply) => {
      const session = await authenticate(request);
      if (!session) return reply.code(401).send({ error: 'unauthenticated' });
      const member = await collaboration.addMember(
        session.account.id, request.params.tripId, request.body.email, request.body.role,
      );
      if (!member) return reply.code(404).send({ error: 'trip_or_verified_account_not_found' });
      return member;
    },
  );

  app.delete<{ Params: { tripId: string; memberId: string } }>(
    '/api/collaboration/trips/:tripId/members/:memberId', {
      schema: {
        params: Type.Object({
          tripId: Type.String({ format: 'uuid' }),
          memberId: Type.String({ format: 'uuid' }),
        }, { additionalProperties: false }),
        response: {
          200: Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false }),
          401: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: csrfGuard,
    }, async (request, reply) => {
      const session = await authenticate(request);
      if (!session) return reply.code(401).send({ error: 'unauthenticated' });
      const removed = await collaboration.removeMember(
        session.account.id, request.params.tripId, request.params.memberId,
      );
      if (!removed) return reply.code(404).send({ error: 'trip_or_member_not_found' });
      return { removed: true as const };
    },
  );
}