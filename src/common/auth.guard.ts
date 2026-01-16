import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { PrismaService } from './prisma.service';

export type AuthContext = {
  apiKeyId: string;
  tenantId: string;
  projectId: string;
  rateLimitPerMinute: number;
  apiKeyPrefix: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthContext }>();
    if (process.env.MOCK_MODE === 'true') {
      request.user = {
        apiKeyId: 'mock',
        tenantId: 'tenant_mock',
        projectId: 'project_mock',
        rateLimitPerMinute: 60,
        apiKeyPrefix: 'mock',
      };
      return true;
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.toString().startsWith('Bearer ')) {
      throw new HttpException({ code: 'AUTH_INVALID', message: 'Missing API key' }, HttpStatus.UNAUTHORIZED);
    }
    const apiKey = authHeader.toString().replace('Bearer ', '').trim();
    const prefix = apiKey.slice(0, 6);
    const hash = createHash('sha256').update(apiKey).digest('hex');

    const keyRecord = await this.prisma.apiKey.findFirst({ where: { prefix } });
    if (!keyRecord || keyRecord.hash !== hash || !keyRecord.isActive) {
      throw new HttpException({ code: 'AUTH_INVALID', message: 'Invalid API key' }, HttpStatus.UNAUTHORIZED);
    }

    request.user = {
      apiKeyId: keyRecord.id,
      tenantId: keyRecord.tenantId,
      projectId: keyRecord.projectId,
      rateLimitPerMinute: keyRecord.rateLimitPerMinute,
      apiKeyPrefix: prefix,
    };
    return true;
  }
}
