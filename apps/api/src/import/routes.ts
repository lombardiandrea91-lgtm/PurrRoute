import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import {
  ApiErrorSchema,
  LinkPreviewRequestSchema,
  LinkPreviewResponseSchema,
} from '@purrroute/contracts';
import type { LinkPreviewRequest, LinkPreviewResponse } from '@purrroute/contracts';
import { LinkImportError } from './link-metadata-adapter.ts';

export interface LinkImportService {
  preview(url: string): Promise<LinkPreviewResponse>;
}

export function registerLinkImportRoutes(app: FastifyInstance, service?: LinkImportService): void {
  if (!service) return;
  const csrfGuard: preHandlerHookHandler = (request, reply, done) => {
    app.csrfProtection(request, reply, done);
  };

  app.post<{ Body: LinkPreviewRequest }>('/api/import/link-preview', {
    schema: {
      body: LinkPreviewRequestSchema,
      response: {
        200: LinkPreviewResponseSchema,
        429: ApiErrorSchema,
        422: ApiErrorSchema,
      },
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: csrfGuard,
  }, async (request, reply) => {
    try {
      return await service.preview(request.body.url);
    } catch (error) {
      if (error instanceof LinkImportError) return reply.code(422).send({ error: 'link_preview_blocked' });
      throw error;
    }
  });
}