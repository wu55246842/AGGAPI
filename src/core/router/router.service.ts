import { Injectable } from '@nestjs/common';
import { UnifiedRequest } from '../unified-schema/types';
import { ModelsService } from '../../modules/models/models.service';
import { ModelCapabilities, ModelPrice, ModelRegions, ModelRouting } from '../../modules/models/model.types';
import { HealthService } from './health.service';
import {
  deriveRequiredCapabilities,
  isRolloutAllowed,
  mergeCapabilities,
  qualityScoreForTier,
  supportsRequiredCapabilities,
} from './router.utils';

export type RoutingContext = {
  tenantId: string;
  projectId: string;
  apiKeyPrefix: string;
  tags?: string[];
};

export type RoutingCandidate = {
  variantId: string;
  provider: string;
  providerModel: string;
  region: string;
  publicModelName: string;
  price: ModelPrice;
  regions: ModelRegions;
  routing: ModelRouting;
  effectiveCapabilities: ModelCapabilities;
  health?: {
    error_rate: number;
    p95_latency_ms: number;
    multiplier: number;
  };
};

export type RoutingDecision = {
  primary: RoutingCandidate;
  fallback: RoutingCandidate[];
};

@Injectable()
export class RouterService {
  constructor(
    private readonly models: ModelsService,
    private readonly health: HealthService,
  ) {}

  async route(request: UnifiedRequest, context: RoutingContext): Promise<RoutingDecision> {
    const constraints = request.constraints;
    const strategy = constraints?.routing?.strategy ?? 'reliability';
    const publicModel = await this.models.getPublicModelWithVariants(request.model);

    if (!publicModel.enabled) {
      throw new Error('Model disabled');
    }

    const requiredCapabilities = deriveRequiredCapabilities(request);
    const regionPreference = constraints?.region?.data_residency;

    let candidates = publicModel.variants.filter((variant) => variant.enabled);

    if (regionPreference) {
      candidates = candidates.filter((variant) => {
        const regions = variant.regionsJson as ModelRegions;
        if (!regions.available_regions.includes(regionPreference)) {
          return false;
        }
        const residency = regions.data_residency?.[regionPreference];
        if (!residency) {
          return false;
        }
        return residency.in_region_processing || residency.cross_region_fallback;
      });
    }

    if (constraints?.routing?.allow_providers?.length) {
      candidates = candidates.filter((variant) =>
        constraints.routing?.allow_providers?.includes(variant.provider),
      );
    }
    if (constraints?.routing?.deny_providers?.length) {
      candidates = candidates.filter(
        (variant) => !constraints.routing?.deny_providers?.includes(variant.provider),
      );
    }

    candidates = candidates.filter((variant) => {
      const routing = variant.routingJson as ModelRouting;
      if (!routing.enabled) {
        return false;
      }
      const targeting = routing.targeting;
      if (targeting.allow_tenants.length && !targeting.allow_tenants.includes(context.tenantId)) {
        return false;
      }
      if (targeting.deny_tenants.includes(context.tenantId)) {
        return false;
      }
      if (targeting.allow_projects.length && !targeting.allow_projects.includes(context.projectId)) {
        return false;
      }
      if (targeting.require_tags.length) {
        const tags = context.tags ?? [];
        const hasAllTags = targeting.require_tags.every((tag) => tags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }
      if (routing.rollout.type === 'percentage') {
        const sticky = context.apiKeyPrefix ?? 'unknown';
        if (!isRolloutAllowed(routing.rollout.percentage, sticky)) {
          return false;
        }
      }
      return true;
    });

    const enrichedCandidates: Array<RoutingCandidate & { health: { error_rate: number; p95_latency_ms: number; multiplier: number } }> = [];
    for (const variant of candidates) {
      const effective = mergeCapabilities(
        publicModel.capabilitiesJson as ModelCapabilities,
        variant.capabilitiesOverride as any,
      );
      if (!supportsRequiredCapabilities(effective, requiredCapabilities)) {
        continue;
      }
      const regions = variant.regionsJson as ModelRegions;
      const region = regionPreference && regions.available_regions.includes(regionPreference)
        ? regionPreference
        : regions.available_regions[0];

      const routing = variant.routingJson as ModelRouting;
      const health = await this.health.getSnapshot(variant.id, routing.health);
      if (health.circuit_open) {
        continue;
      }

      enrichedCandidates.push({
        variantId: variant.id,
        provider: variant.provider,
        providerModel: variant.providerModel,
        region,
        publicModelName: publicModel.publicName,
        price: variant.priceJson as ModelPrice,
        regions,
        routing,
        effectiveCapabilities: effective,
        health: {
          error_rate: health.error_rate,
          p95_latency_ms: health.p95_latency_ms,
          multiplier: health.multiplier,
        },
      });
    }

    if (!enrichedCandidates.length) {
      throw new Error('No matching providers for model');
    }

    const bias = {
      cost: strategy === 'cost' ? 1.5 : 1,
      latency: strategy === 'latency' ? 1.5 : 1,
      reliability: strategy === 'reliability' ? 1.5 : 1,
      quality: strategy === 'quality' ? 1.5 : 1,
    };

    const scored = enrichedCandidates
      .map((candidate) => {
        const routing = candidate.routing;
        const weights = routing.weights;
        const cost = candidate.price.unit_prices.input_per_1k + candidate.price.unit_prices.output_per_1k;
        const costScore = 1 / (1 + cost);
        const health = candidate.health ?? { p95_latency_ms: 0, error_rate: 0, multiplier: 1 };
        const latencyScore = 1 / (1 + health.p95_latency_ms);
        const reliabilityScore = 1 - health.error_rate;
        const qualityScore = qualityScoreForTier(candidate.effectiveCapabilities.quality_tier);
        const baseScore =
          weights.base_weight +
          weights.cost_weight * costScore * bias.cost +
          weights.latency_weight * latencyScore * bias.latency +
          weights.quality_weight * qualityScore * bias.quality +
          weights.base_weight * reliabilityScore * bias.reliability;
        const multiplier = health.multiplier ?? 1;
        return { candidate, score: baseScore * multiplier };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.candidate as RoutingCandidate);

    const maxFallbacks = constraints?.routing?.max_fallbacks ?? 2;
    const [primary, ...rest] = scored;
    return { primary, fallback: rest.slice(0, maxFallbacks) };
  }
}
