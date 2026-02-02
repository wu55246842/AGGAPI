import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ResponsesService } from '../responses/responses.service';
import { JobsService } from './jobs.service';

@Processor('jobs')
export class JobsProcessor extends WorkerHost {
  constructor(
    private readonly responses: ResponsesService,
    private readonly jobs: JobsService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; request: any; requestId: string }>): Promise<void> {
    try {
      const response = await this.responses.generate(
        job.data.request,
        job.data.requestId,
        { apiKeyId: 'job', tenantId: 'job', projectId: 'job', apiKeyPrefix: 'job' },
      );
      await this.jobs.updateJobSuccess(job.data.jobId, response);
    } catch (error) {
      await this.jobs.updateJobFailure(job.data.jobId, {
        message: (error as Error).message,
      });
    }
  }
}
