import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { UnifiedRequest, UnifiedResponse } from '../../core/unified-schema/types';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('jobs') private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async createJob(request: UnifiedRequest, requestId: string) {
    const record = await this.prisma.jobRecord.create({
      data: {
        status: 'queued',
        request: request as any,
      },
    });
    await this.queue.add('run', { jobId: record.id, request, requestId });
    return {
      id: record.id,
      status: record.status,
      created: Math.floor(record.createdAt.getTime() / 1000),
      updated: Math.floor(record.updatedAt.getTime() / 1000),
      request,
    };
  }

  async updateJobSuccess(jobId: string, response: UnifiedResponse) {
    const record = await this.prisma.jobRecord.update({
      where: { id: jobId },
      data: { status: 'succeeded', response: response as any },
    });
    return record;
  }

  async updateJobFailure(jobId: string, error: any) {
    const record = await this.prisma.jobRecord.update({
      where: { id: jobId },
      data: { status: 'failed', error: error as any },
    });
    return record;
  }

  async getJob(jobId: string) {
    return this.prisma.jobRecord.findUnique({ where: { id: jobId } });
  }

  async listJobs() {
    return this.prisma.jobRecord.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
  }
}
