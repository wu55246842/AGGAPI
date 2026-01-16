import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { UsageService } from './usage.service';
import { AuthGuard } from '../../common/auth.guard';
import { RateLimitGuard } from '../../common/rate-limit.guard';

@Controller('v1/usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  @UseGuards(AuthGuard, RateLimitGuard)
  async getUsage(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() request: FastifyRequest & { user?: any },
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.usage.aggregate(request.user.tenantId, request.user.projectId, fromDate, toDate);
  }
}
