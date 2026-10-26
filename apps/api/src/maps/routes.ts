import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import {
  ApiErrorSchema,
  PlaceSearchRequestSchema,
  PlaceSearchResponseSchema,
  RouteRequestSchema,
  RouteResponseSchema,
} from '@purrroute/contracts';
import type { PlaceSearchRequest, RouteRequest } from '@purrroute/contracts';
import { LocationIqAdapter, MapProviderError } from './locationiq-adapter.ts';

export type MapServices = Pick<LocationIqAdapter, 'searchPlaces' | 'route'>;

function statusForProviderError(error: MapProviderError): number {
  switch (error.code) {
    case 'invalid_request': return 400;
    case 'no_route': return 422;
    case 'rate_limited':
    case 'daily_quota': return 429;
    default: return 503;
  }
}

export function registerMapRoutes(app: FastifyInstance, services?: MapServices): void {
  const csrfGuard: preHandlerHookHandler = (request, reply, done) => {
    app.csrfProtection(request, reply, done);
  };

  app.post<{ Body: PlaceSearchRequest }>('/api/maps/search', {
    schema: {
      body: PlaceSearchRequestSchema,
      response: { 200: PlaceSearchResponseSchema, 400: ApiErrorSchema, 429: ApiErrorSchema, 503: ApiErrorSchema },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    if (!services) return reply.code(503).send({ error: 'geocoding_not_configured' });
    try {
      const results = await services.searchPlaces(request.body.query, request.body.locale);
      return { results, attribution: 'Search by LocationIQ.com' };
    } catch (error) {
      if (error instanceof MapProviderError) return reply.code(statusForProviderError(error)).send({ error: error.code });
      return reply.code(503).send({ error: 'geocoding_unavailable' });
    }
  });

  app.post<{ Body: RouteRequest }>('/api/maps/route', {
    schema: {
      body: RouteRequestSchema,
      response: { 200: RouteResponseSchema, 400: ApiErrorSchema, 422: ApiErrorSchema, 429: ApiErrorSchema, 503: ApiErrorSchema },
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    if (!services) return reply.code(503).send({ error: 'routing_not_configured' });
    try {
      return await services.route(request.body.coordinates, request.body.profile);
    } catch (error) {
      if (error instanceof MapProviderError) return reply.code(statusForProviderError(error)).send({ error: error.code });
      return reply.code(503).send({ error: 'routing_unavailable' });
    }
  });
}