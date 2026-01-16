import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import Redis from 'ioredis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: any }>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const limit = user.rateLimitPerMinute ?? 60;
    const key = `rate:${user.tenantId}:${user.projectId}:${user.apiKeyId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60);
    }
    if (count > limit) {
      throw new HttpException({ code: 'RATE_LIMITED', message: 'Rate limit exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
