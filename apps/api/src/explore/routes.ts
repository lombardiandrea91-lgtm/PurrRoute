import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import {
  ApiErrorSchema,
  NearbyExploreRequestSchema,
  NearbyExploreResponseSchema,
} from '@purrroute/contracts';
import type { NearbyExploreRequest } from '@purrroute/contracts';
import { WikidataExploreError } from './wikidata-adapter.ts';

export interface ExploreServices {
  nearby(request: NearbyExploreRequest): ReturnType<import('./wikidata-adapter.ts').WikidataExploreAdapter['nearby']>;
}

function statusFor(error: WikidataExploreError): number {
  if (error.code === 'invalid_request') return 400;
  if (error.code === 'rate_limited') return 429;
  return 503;
}

export function registerExploreRoutes(app: FastifyInstance, services?: ExploreServices): void {
  const csrfGuard: preHandlerHookHandler = (request, reply, done) => {
    app.csrfProtection(request, reply, done);
  };

  app.post<{ Body: NearbyExploreRequest }>('/api/explore/nearby', {
    schema: {
      body: NearbyExploreRequestSchema,
      response: {
        200: NearbyExploreResponseSchema,
        400: ApiErrorSchema,
        429: ApiErrorSchema,
        503: ApiErrorSchema,
      },
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    if (!services) return reply.code(503).send({ error: 'explore_not_configured' });
    try {
      return { results: await services.nearby(request.body), attribution: 'Wikidata' as const };
    } catch (error) {
      if (error instanceof WikidataExploreError) {
        const errorCode = error.code === 'rate_limited' ? 'explore_rate_limited'
          : error.code === 'timeout' ? 'explore_timeout'
            : error.code === 'invalid_request' ? 'invalid_request' : 'explore_unavailable';
        return reply.code(statusFor(error)).send({ error: errorCode });
      }
      return reply.code(503).send({ error: 'explore_unavailable' });
    }
  });
}