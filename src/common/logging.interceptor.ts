import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { JsonLogger } from './logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: JsonLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<any>();
    const response = ctx.getResponse<any>();

    return next.handle().pipe(
      tap(() => {
        const latency = Date.now() - now;
        this.logger.log('request_completed', {
          request_id: request.requestId,
          tenant_id: request.user?.tenantId,
          project_id: request.user?.projectId,
          provider: request.user?.provider,
          model: request.user?.model,
          status: response.statusCode,
          latency_ms: latency,
          method: request.method,
          path: (request as any).url,
        });
      }),
    );
  }
}
