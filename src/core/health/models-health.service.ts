import { Injectable } from '@nestjs/common';
import { HealthService } from '../router/health.service';
import { ModelRouting } from '../../modules/models/model.types';

export type ModelHealthView = {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  score: number;
  error_rate: number;
  p95_latency_ms: number;
  cooldown_until: string | null;
};

@Injectable()
export class ModelsHealthService {
  constructor(private readonly health: HealthService) {}

  async getVariantHealth(
    variantId: string,
    routingHealth: ModelRouting['health'],
    windowMinutes = 5,
  ): Promise<ModelHealthView> {
    try {
      const snapshot = await this.health.getSnapshot(variantId, routingHealth, windowMinutes);

      if (snapshot.requests === 0) {
        return {
          status: 'unknown',
          score: 0,
          error_rate: 0,
          p95_latency_ms: 0,
          cooldown_until: null,
        };
      }

      const errorRate = snapshot.error_rate;
      const p95Latency = snapshot.p95_latency_ms;
      const cooldownUntil = await this.health.getCooldownUntil(variantId);
      const circuitOpen = Boolean(cooldownUntil);

      let status: ModelHealthView['status'] = 'healthy';
      if (circuitOpen || errorRate >= 0.3) {
        status = 'down';
      } else if (errorRate >= 0.1 || p95Latency >= 1500) {
        status = 'degraded';
      }

      const latencyScore = 1 / (1 + p95Latency / 1000);
      const reliabilityScore = 1 - errorRate;
      const score = Math.max(0, Math.min(1, reliabilityScore * 0.7 + latencyScore * 0.3));

      return {
        status,
        score,
        error_rate: errorRate,
        p95_latency_ms: p95Latency,
        cooldown_until: cooldownUntil,
      };
    } catch (error) {
      return {
        status: 'unknown',
        score: 0,
        error_rate: 0,
        p95_latency_ms: 0,
        cooldown_until: null,
      };
    }
  }
}
