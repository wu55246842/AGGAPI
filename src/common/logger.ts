import { LoggerService } from '@nestjs/common';
import { trace, context } from '@opentelemetry/api';

const getTraceId = () => {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId;
};

export class JsonLogger implements LoggerService {
  log(message: string, meta?: Record<string, unknown>) {
    this.write('info', message, meta);
  }

  error(message: string, traceStr?: string, meta?: Record<string, unknown>) {
    this.write('error', message, { ...meta, trace: traceStr });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.write('warn', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.write('debug', message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>) {
    this.write('verbose', message, meta);
  }

  private write(level: string, message: string, meta?: Record<string, unknown>) {
    const payload = {
      level,
      message,
      trace_id: getTraceId(),
      ...meta,
      timestamp: new Date().toISOString(),
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}
