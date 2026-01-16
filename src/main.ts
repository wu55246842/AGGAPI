import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { initTelemetry, shutdownTelemetry } from './common/otel';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { JsonLogger } from './common/logger';
import { LoggingInterceptor } from './common/logging.interceptor';

async function bootstrap() {
  await initTelemetry();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  const logger = app.get(JsonLogger);
  app.useLogger(logger);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen({ port, host: '0.0.0.0' });

  process.on('SIGTERM', async () => {
    await shutdownTelemetry();
    await app.close();
  });
}

bootstrap();
