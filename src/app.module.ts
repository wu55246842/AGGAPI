import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ResponsesController } from './modules/responses/responses.controller';
import { ResponsesService } from './modules/responses/responses.service';
import { JobsController } from './modules/jobs/jobs.controller';
import { JobsService } from './modules/jobs/jobs.service';
import { JobsProcessor } from './modules/jobs/jobs.processor';
import { ModelsController } from './modules/models/models.controller';
import { ModelsService } from './modules/models/models.service';
import { AdminController } from './modules/admin/admin.controller';
import { UsageController } from './modules/usage/usage.controller';
import { UsageService } from './modules/usage/usage.service';
import { RouterService } from './core/router/router.service';
import { HealthService } from './core/router/health.service';
import { ProviderRegistry } from './providers/provider.registry';
import { PrismaService } from './common/prisma.service';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { JsonLogger } from './common/logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue({ name: 'jobs' }),
  ],
  controllers: [ResponsesController, JobsController, ModelsController, UsageController, AdminController],
  providers: [
    ResponsesService,
    JobsService,
    JobsProcessor,
    UsageService,
    RouterService,
    ModelsService,
    HealthService,
    ProviderRegistry,
    PrismaService,
    JsonLogger,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
