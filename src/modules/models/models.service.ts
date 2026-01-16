import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ModelCapabilities, ModelCapabilitiesOverride, ModelPrice, ModelRegions, ModelRouting } from './model.types';

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
  constructor(private readonly prisma: PrismaService) {}

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
