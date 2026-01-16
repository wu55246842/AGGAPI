import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest & { requestId?: string }, reply: FastifyReply, next: () => void) {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.requestId = requestId;
    reply.header('x-request-id', requestId);
    next();
  }
}
