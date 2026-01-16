import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ModelsCatalogService, PublicModelCatalog } from '../../core/catalog/models-catalog.service';
import { ModelsHealthService } from '../../core/health/models-health.service';
import {
  ModelCapabilities,
  ModelCapabilitiesOverride,
  ModelPrice,
  ModelRegions,
  ModelRouting,
} from './model.types';

export type PublicModelRecord = {
  id: string;
  publicName: string;
  description: string | null;
  enabled: boolean;
  capabilitiesJson: ModelCapabilities;
};

export type ModelVariantRecord = {
  id: string;
  publicModelId: string;
  provider: string;
  providerModel: string;
  enabled: boolean;
  priceJson: ModelPrice;
  regionsJson: ModelRegions;
  routingJson: ModelRouting;
  capabilitiesOverride: ModelCapabilitiesOverride | null;
};

@Injectable()
export class ModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: ModelsCatalogService,
    private readonly health: ModelsHealthService,
  ) {}

  async listPublicModels(includeDisabled = false) {
    const models = await this.prisma.publicModel.findMany({
      where: includeDisabled ? undefined : { enabled: true },
      include: { variants: true },
      orderBy: { publicName: 'asc' },
    });

    return models.map((model) => ({
      id: model.id,
      public_name: model.publicName,
      description: model.description,
      enabled: model.enabled,
      capabilities: model.capabilitiesJson,
      variants: model.variants
        .filter((variant) => (includeDisabled ? true : variant.enabled))
        .map((variant) => ({
          id: variant.id,
          provider: variant.provider,
          provider_model: variant.providerModel,
          enabled: variant.enabled,
          pricing: variant.priceJson,
          regions: variant.regionsJson,
          routing: variant.routingJson,
          capabilities_override: variant.capabilitiesOverride,
        })),
    }));
  }

  async listAggregatedModels() {
    const models = await this.prisma.publicModel.findMany({
      include: { variants: true },
      orderBy: { publicName: 'asc' },
    });

    const defaultStrategy = 'reliability' as const;

    const data = await Promise.all(
      models.map(async (model) => {
        const publicModel: PublicModelCatalog = {
          id: model.id,
          publicName: model.publicName,
          enabled: model.enabled,
          capabilitiesJson: model.capabilitiesJson as ModelCapabilities,
          variants: model.variants.map((variant) => ({
            id: variant.id,
            provider: variant.provider,
            providerModel: variant.providerModel,
            enabled: variant.enabled,
            priceJson: variant.priceJson as ModelPrice,
            regionsJson: variant.regionsJson as ModelRegions,
            routingJson: variant.routingJson as ModelRouting,
            capabilitiesOverride: variant.capabilitiesOverride as ModelCapabilitiesOverride,
            updatedAt: variant.updatedAt,
          })),
        };

        const variantViews = await Promise.all(
          publicModel.variants.map(async (variant) => {
            const routing = variant.routingJson ?? ({} as ModelRouting);
            const effectiveSupports = this.catalog.buildEffectiveSupports(
              publicModel.capabilitiesJson,
              variant.capabilitiesOverride,
            );
            const pricingSummary = this.catalog.buildPricingSummary(variant.priceJson);
            const regions = this.catalog.normalizeRegions(variant.regionsJson);
            const rollout = this.catalog.normalizeRollout(routing.rollout);
            const weights = this.catalog.normalizeWeights(routing.weights);
            const healthConfig = this.catalog.normalizeHealth(routing.health);
            const enabled = this.catalog.computeVariantEnabled(
              publicModel.enabled,
              variant.enabled,
              routing.enabled,
            );
            const health = process.env.MOCK_MODE === 'true'
              ? {
                  status: 'unknown' as const,
                  score: 0,
                  error_rate: 0,
                  p95_latency_ms: 0,
                  cooldown_until: null,
                }
              : await this.health.getVariantHealth(variant.id, healthConfig);

            return {
              id: variant.id,
              provider: { name: variant.provider },
              provider_model: variant.providerModel,
              regions: {
                available_regions: regions.available_regions,
                data_residency: regions.data_residency,
              },
              effective_supports: {
                streaming: effectiveSupports.streaming,
                tools: effectiveSupports.tools,
                json_schema: effectiveSupports.json_schema,
                vision: effectiveSupports.vision,
                audio_in: effectiveSupports.audio_in,
                audio_out: effectiveSupports.audio_out,
              },
              pricing_summary: pricingSummary,
              enabled,
              rollout,
              routing: { weights },
              health,
              last_updated: variant.updatedAt.toISOString(),
            };
          }),
        );

        const recommended = this.catalog.recommendDefault(publicModel, defaultStrategy);

        return {
          public_model: {
            id: publicModel.id,
            public_name: publicModel.publicName,
            modality: publicModel.capabilitiesJson.modality,
            capabilities: publicModel.capabilitiesJson,
            lifecycle: {
              status: 'ga',
              enabled: publicModel.enabled,
              deprecation: { date: null, replacement: null },
            },
            tags: publicModel.enabled ? ['recommended'] : [],
          },
          variants: variantViews,
          recommended_default: recommended,
        };
      }),
    );

    return {
      data,
      meta: {
        generated_at: new Date().toISOString(),
        default_routing_strategy: defaultStrategy,
      },
    };
  }

  async getPublicModelWithVariants(publicName: string) {
    const model = await this.prisma.publicModel.findFirst({
      where: { publicName },
      include: { variants: true },
    });

    if (!model) {
      throw new NotFoundException(`Model ${publicName} not found`);
    }

    return model;
  }

  async setPublicModelEnabled(publicModelId: string, enabled: boolean) {
    return this.prisma.publicModel.update({ where: { id: publicModelId }, data: { enabled } });
  }

  async setVariantEnabled(variantId: string, enabled: boolean) {
    return this.prisma.modelVariant.update({ where: { id: variantId }, data: { enabled } });
  }

  async updateVariantWeights(variantId: string, weights: ModelRouting['weights']) {
    const variant = await this.prisma.modelVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }
    const routing = variant.routingJson as ModelRouting;
    return this.prisma.modelVariant.update({
      where: { id: variantId },
      data: { routingJson: { ...routing, weights } },
    });
  }

  async updateVariantRollout(variantId: string, rollout: ModelRouting['rollout']) {
    const variant = await this.prisma.modelVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }
    const routing = variant.routingJson as ModelRouting;
    return this.prisma.modelVariant.update({
      where: { id: variantId },
      data: { routingJson: { ...routing, rollout } },
    });
  }
}
