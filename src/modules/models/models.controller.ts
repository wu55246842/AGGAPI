import { Controller, Get } from '@nestjs/common';
import { MODEL_CATALOG } from './catalog';

@Controller('v1/models')
export class ModelsController {
  @Get()
  listModels() {
    return {
      data: MODEL_CATALOG.map((model) => ({
        id: model.id,
        public_name: model.publicName,
        modality: model.modality,
        capabilities: model.capabilities,
        pricing: model.pricing,
        regions: model.regions,
      })),
    };
  }
}
