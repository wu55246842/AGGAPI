import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ModelRouting } from '../../modules/models/model.types';

export type HealthSnapshot = {
  requests: number;
  errors: number;
  error_rate: number;
  p95_latency_ms: number;
  multiplier: number;
  circuit_open: boolean;
};

@Injectable()
export class HealthService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  private bucketKey(variantId: string, bucket: number) {
    return `health:${variantId}:${bucket}`;
  }

  async recordSuccess(variantId: string, latencyMs: number) {
    await this.record(variantId, latencyMs, false);
  }

  async recordFailure(variantId: string, latencyMs: number) {
    await this.record(variantId, latencyMs, true);
  }

  private async record(variantId: string, latencyMs: number, isError: boolean) {
    const bucket = Math.floor(Date.now() / 60000);
    const key = this.bucketKey(variantId, bucket);
    const latencyKey = `${key}:latency`;
    const pipeline = this.redis.pipeline();
    pipeline.hincrby(key, 'requests', 1);
    if (isError) {
      pipeline.hincrby(key, 'errors', 1);
    }
    pipeline.rpush(latencyKey, latencyMs.toString());
    pipeline.expire(key, 600);
    pipeline.expire(latencyKey, 600);
    await pipeline.exec();
  }

  async getSnapshot(variantId: string, routingHealth: ModelRouting['health'], windowMinutes = 5): Promise<HealthSnapshot> {
    const nowBucket = Math.floor(Date.now() / 60000);
    const buckets = Array.from({ length: windowMinutes }, (_, idx) => nowBucket - idx);
    const pipeline = this.redis.pipeline();
    for (const bucket of buckets) {
      const key = this.bucketKey(variantId, bucket);
      pipeline.hgetall(key);
      pipeline.lrange(`${key}:latency`, 0, -1);
    }
    const results = await pipeline.exec();

    let requests = 0;
    let errors = 0;
    const latencies: number[] = [];

    for (let i = 0; i < results.length; i += 2) {
      const [, hashResult] = results[i] ?? [];
      const [, listResult] = results[i + 1] ?? [];
      if (hashResult) {
        const hash = hashResult as Record<string, string>;
        requests += Number(hash.requests ?? 0);
        errors += Number(hash.errors ?? 0);
      }
      if (Array.isArray(listResult)) {
        for (const entry of listResult) {
          const latency = Number(entry);
          if (!Number.isNaN(latency)) {
            latencies.push(latency);
          }
        }
      }
    }

    const errorRate = requests > 0 ? errors / requests : 0;
    const p95Latency = latencies.length ? this.percentile(latencies, 0.95) : 0;

    if (!routingHealth.enabled) {
      return {
        requests,
        errors,
        error_rate: errorRate,
        p95_latency_ms: p95Latency,
        multiplier: 1,
        circuit_open: false,
      };
    }

    const circuitKey = `health:cb:${variantId}`;
    const circuitOpen = (await this.redis.exists(circuitKey)) === 1;

    let circuitShouldOpen = false;
    if (
      requests >= routingHealth.circuit_breaker.min_requests &&
      errorRate >= routingHealth.circuit_breaker.failure_rate_threshold
    ) {
      circuitShouldOpen = true;
      await this.redis.set(circuitKey, '1', 'EX', routingHealth.circuit_breaker.cooldown_seconds);
    }

    let multiplier = 1;
    if (p95Latency > routingHealth.penalties.p95_latency_ms.threshold) {
      multiplier *= routingHealth.penalties.p95_latency_ms.multiplier;
    }
    if (errorRate > routingHealth.penalties.error_rate.threshold) {
      multiplier *= routingHealth.penalties.error_rate.multiplier;
    }

    return {
      requests,
      errors,
      error_rate: errorRate,
      p95_latency_ms: p95Latency,
      multiplier,
      circuit_open: circuitOpen || circuitShouldOpen,
    };
  }

  private percentile(values: number[], percentile: number) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(percentile * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
