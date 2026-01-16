import { Injectable } from '@nestjs/common';
import { UnifiedRequest } from '../unified-schema/types';
import { MODEL_CATALOG, ModelCatalogEntry } from '../../modules/models/catalog';

export type RoutingDecision = {
  provider: string;
  providerModel: string;
  model: ModelCatalogEntry;
  fallback: { provider: string; providerModel: string }[];
};

@Injectable()
export class RouterService {
  route(request: UnifiedRequest): RoutingDecision {
    const constraints = request.constraints;
    const strategy = constraints?.routing?.strategy ?? 'reliability';
    let candidates = MODEL_CATALOG.filter((model) => model.publicName === request.model);

    if (constraints?.routing?.allow_providers?.length) {
      candidates = candidates.filter((model) =>
        constraints.routing?.allow_providers?.includes(model.provider),
      );
    }
    if (constraints?.routing?.deny_providers?.length) {
      candidates = candidates.filter(
        (model) => !constraints.routing?.deny_providers?.includes(model.provider),
      );
    }

    if (!candidates.length) {
      throw new Error('No matching providers for model');
    }

    const sorted = [...candidates].sort((a, b) => {
      if (strategy === 'cost') {
        return a.pricing.input_per_1k + a.pricing.output_per_1k - (b.pricing.input_per_1k + b.pricing.output_per_1k);
      }
      if (strategy === 'latency') {
        return a.regions.length - b.regions.length;
      }
      if (strategy === 'quality') {
        return b.pricing.output_per_1k - a.pricing.output_per_1k;
      }
      return a.provider.localeCompare(b.provider);
    });

    const [primary, ...rest] = sorted;
    const fallback = rest.slice(0, 2).map((model) => ({ provider: model.provider, providerModel: model.providerModel }));

    return {
      provider: primary.provider,
      providerModel: primary.providerModel,
      model: primary,
      fallback,
    };
  }
}
