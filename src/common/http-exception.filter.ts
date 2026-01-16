import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { buildError, errorStatusMap } from './errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest & { requestId?: string }>();
    const requestId = request.requestId ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse() as Record<string, unknown>;
      const code = (responseBody?.code as string) ?? 'BAD_REQUEST';
      const message = (responseBody?.message as string) ?? exception.message;
      const details = responseBody?.details as Record<string, unknown> | undefined;
      const provider = responseBody?.provider as any;
      response.status(status).send(buildError(code, message, requestId, details, provider));
      return;
    }

    const status =
      typeof exception === 'object' && exception && 'code' in exception
        ? errorStatusMap[(exception as { code: string }).code] ?? HttpStatus.INTERNAL_SERVER_ERROR
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : 'Internal error';
    response.status(status).send(buildError('INTERNAL_ERROR', message, requestId));
  }
}
