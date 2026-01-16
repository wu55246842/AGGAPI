import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const adminKey = process.env.ADMIN_KEY;
    const headerKey = request.headers['x-admin-key'];
    if (!adminKey) {
      throw new HttpException({ code: 'ADMIN_KEY_MISSING', message: 'Admin key not configured' }, HttpStatus.UNAUTHORIZED);
    }
    if (!headerKey || headerKey.toString() !== adminKey) {
      throw new HttpException({ code: 'ADMIN_UNAUTHORIZED', message: 'Invalid admin key' }, HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}
