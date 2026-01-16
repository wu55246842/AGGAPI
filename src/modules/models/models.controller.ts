import { Controller, Get } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller('v1/models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  async listModels() {
    return {
      data: await this.models.listPublicModels(false),
    };
  }
}
