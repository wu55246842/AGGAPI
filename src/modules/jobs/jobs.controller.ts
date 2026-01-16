import { Controller, Get, Param, Post, Body, Req, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { JobsService } from './jobs.service';
import { UnifiedRequest } from '../../core/unified-schema/types';
import { AuthGuard } from '../../common/auth.guard';
import { RateLimitGuard } from '../../common/rate-limit.guard';

@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @UseGuards(AuthGuard, RateLimitGuard)
  async createJob(
    @Body() body: { request: UnifiedRequest },
    @Req() request: FastifyRequest & { requestId?: string },
    @Res() reply: FastifyReply,
  ) {
    const job = await this.jobs.createJob(body.request, request.requestId ?? 'unknown');
    reply.status(202).send(job);
  }

  @Get()
  @UseGuards(AuthGuard, RateLimitGuard)
  async listJobs(@Res() reply: FastifyReply) {
    const jobs = await this.jobs.listJobs();
    reply.send({ data: jobs });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RateLimitGuard)
  async getJob(@Param('id') id: string, @Res() reply: FastifyReply) {
    const job = await this.jobs.getJob(id);
    if (!job) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found' });
    }
    reply.send(job);
  }
}
