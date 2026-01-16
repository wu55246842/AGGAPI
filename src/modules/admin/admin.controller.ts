import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { ModelsService } from '../models/models.service';
import { ModelRouting } from '../models/model.types';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly models: ModelsService) {}

  @Get('models')
  async listModels() {
    return { data: await this.models.listPublicModels(true) };
  }

  @Post('models/:publicModelId/enable')
  async enableModel(@Param('publicModelId') publicModelId: string) {
    const model = await this.models.setPublicModelEnabled(publicModelId, true);
    return { id: model.id, enabled: model.enabled };
  }

  @Post('models/:publicModelId/disable')
  async disableModel(@Param('publicModelId') publicModelId: string) {
    const model = await this.models.setPublicModelEnabled(publicModelId, false);
    return { id: model.id, enabled: model.enabled };
  }

  @Post('variants/:variantId/enable')
  async enableVariant(@Param('variantId') variantId: string) {
    const variant = await this.models.setVariantEnabled(variantId, true);
    return { id: variant.id, enabled: variant.enabled };
  }

  @Post('variants/:variantId/disable')
  async disableVariant(@Param('variantId') variantId: string) {
    const variant = await this.models.setVariantEnabled(variantId, false);
    return { id: variant.id, enabled: variant.enabled };
  }

  @Post('variants/:variantId/weights')
  async updateWeights(
    @Param('variantId') variantId: string,
    @Body() body: { weights: ModelRouting['weights'] },
  ) {
    const variant = await this.models.updateVariantWeights(variantId, body.weights);
    return { id: variant.id, routing: variant.routingJson };
  }

  @Post('variants/:variantId/rollout')
  async updateRollout(
    @Param('variantId') variantId: string,
    @Body() body: { rollout: ModelRouting['rollout'] },
  ) {
    const variant = await this.models.updateVariantRollout(variantId, body.rollout);
    return { id: variant.id, routing: variant.routingJson };
  }
}
