import { Injectable } from '@nestjs/common';
import {
  ModelCapabilities,
  ModelCapabilitiesOverride,
  ModelCapabilitySupports,
  ModelPrice,
  ModelRegions,
  ModelRouting,
} from '../../modules/models/model.types';
import { qualityScoreForTier } from '../router/router.utils';

export type PricingSummary = {
  currency: 'USD';
  billing_model: 'token';
  version: string;
  unit_prices: {
    input_per_1k: number;
    output_per_1k: number;
  };
};

export type RecommendedDefault = {
  variant_id: string | null;
  provider: string | null;
  region: string | null;
  reason: string;
};

export type CatalogVariant = {
  id: string;
  provider: string;
  providerModel: string;
  enabled: boolean;
  priceJson: ModelPrice | null;
  regionsJson: ModelRegions | null;
  routingJson: ModelRouting | null;
  capabilitiesOverride: ModelCapabilitiesOverride | null;
  updatedAt: Date;
};

export type PublicModelCatalog = {
  id: string;
  publicName: string;
  enabled: boolean;
  capabilitiesJson: ModelCapabilities;
  variants: CatalogVariant[];
};

const DEFAULT_ROLLOUT: ModelRouting['rollout'] = {
  type: 'percentage',
  percentage: 100,
  sticky_key: 'api_key_prefix',
};

const DEFAULT_WEIGHTS: ModelRouting['weights'] = {
  base_weight: 100,
  quality_weight: 1,
  cost_weight: 1,
  latency_weight: 1,
};

const DEFAULT_HEALTH: ModelRouting['health'] = {
  enabled: true,
  circuit_breaker: { failure_rate_threshold: 0.3, min_requests: 20, cooldown_seconds: 60 },
  penalties: {
    p95_latency_ms: { threshold: 1500, multiplier: 0.8 },
    error_rate: { threshold: 0.1, multiplier: 0.8 },
  },
};

const REQUIRED_DEFAULT_SUPPORTS: Array<keyof ModelCapabilitySupports> = [
  'streaming',
  'tools',
  'json_schema',
  'vision',
];

@Injectable()
export class ModelsCatalogService {
  mergeSupports(
    base: ModelCapabilitySupports,
    override?: Partial<ModelCapabilitySupports>,
  ): ModelCapabilitySupports {
    return {
      ...base,
      ...(override ?? {}),
    };
  }

  buildEffectiveSupports(
    publicCapabilities: ModelCapabilities,
    override?: ModelCapabilitiesOverride | null,
  ): ModelCapabilitySupports {
    return this.mergeSupports(publicCapabilities.supports, override?.supports);
  }

  normalizeRegions(regions?: ModelRegions | null): ModelRegions {
    return {
      available_regions: regions?.available_regions ?? [],
      data_residency: regions?.data_residency ?? {},
    };
  }

  normalizeRollout(rollout?: ModelRouting['rollout'] | null): ModelRouting['rollout'] {
    return rollout ?? DEFAULT_ROLLOUT;
  }

  normalizeWeights(weights?: ModelRouting['weights'] | null): ModelRouting['weights'] {
    return weights ?? DEFAULT_WEIGHTS;
  }

  normalizeHealth(health?: ModelRouting['health'] | null): ModelRouting['health'] {
    return health ?? DEFAULT_HEALTH;
  }

  buildPricingSummary(price?: ModelPrice | null): PricingSummary {
    return {
      currency: price?.currency ?? 'USD',
      billing_model: price?.billing_model ?? 'token',
      version: price?.version ?? 'unknown',
      unit_prices: {
        input_per_1k: price?.unit_prices?.input_per_1k ?? 0,
        output_per_1k: price?.unit_prices?.output_per_1k ?? 0,
      },
    };
  }

  computeVariantEnabled(publicEnabled: boolean, variantEnabled: boolean, routingEnabled?: boolean | null) {
    return publicEnabled && variantEnabled && (routingEnabled ?? true);
  }

  recommendDefault(
    publicModel: PublicModelCatalog,
    strategy: 'reliability' | 'cost' | 'latency' | 'quality' = 'reliability',
  ): RecommendedDefault {
    const candidates = publicModel.variants
      .map((variant) => {
        const effectiveSupports = this.buildEffectiveSupports(
          publicModel.capabilitiesJson,
          variant.capabilitiesOverride,
        );
        const routing = variant.routingJson ?? ({} as ModelRouting);
        const enabled = this.computeVariantEnabled(publicModel.enabled, variant.enabled, routing.enabled);
        return { variant, effectiveSupports, enabled, routing };
      })
      .filter((entry) => entry.enabled);

    const preferred = candidates.filter((entry) =>
      REQUIRED_DEFAULT_SUPPORTS.every((key) => entry.effectiveSupports[key] === true),
    );

    const scored = (preferred.length ? preferred : candidates)
      .map((entry) => {
        const routing = entry.routing;
        const weights = this.normalizeWeights(routing.weights);
        const price = entry.variant.priceJson;
        const cost =
          (price?.unit_prices?.input_per_1k ?? 0) + (price?.unit_prices?.output_per_1k ?? 0);
        const costScore = 1 / (1 + cost);
        const regions = this.normalizeRegions(entry.variant.regionsJson);
        const regionScore = Math.min(1, regions.available_regions.length / 3 || 0.5);
        const qualityScore = qualityScoreForTier(publicModel.capabilitiesJson.quality_tier);
        const bias = {
          cost: strategy === 'cost' ? 1.5 : 1,
          latency: strategy === 'latency' ? 1.5 : 1,
          reliability: strategy === 'reliability' ? 1.5 : 1,
          quality: strategy === 'quality' ? 1.5 : 1,
        };
        const score =
          weights.base_weight +
          weights.cost_weight * costScore * bias.cost +
          weights.latency_weight * regionScore * bias.latency +
          weights.quality_weight * qualityScore * bias.quality +
          weights.base_weight * regionScore * bias.reliability;

        return { entry, score, regions };
      })
      .sort((a, b) => b.score - a.score);

    const winner = scored[0]?.entry;
    const regions = scored[0]?.regions ?? { available_regions: [] };
    if (!winner) {
      return {
        variant_id: null,
        provider: null,
        region: null,
        reason: `router_estimate:${strategy}`,
      };
    }

    return {
      variant_id: winner.variant.id,
      provider: winner.variant.provider,
      region: regions.available_regions[0] ?? null,
      reason: `router_estimate:${strategy}`,
    };
  }
}
