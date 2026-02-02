import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ModelLifecycleDeprecationDto {
  @IsOptional()
  @IsString()
  date?: string | null;

  @IsOptional()
  @IsString()
  replacement?: string | null;
}

export class ModelLifecycleDto {
  @IsString()
  @IsIn(['ga', 'beta', 'deprecated'])
  status!: 'ga' | 'beta' | 'deprecated';

  @IsBoolean()
  enabled!: boolean;

  @ValidateNested()
  @Type(() => ModelLifecycleDeprecationDto)
  deprecation!: ModelLifecycleDeprecationDto;
}

export class ModelPublicDto {
  @IsString()
  id!: string;

  @IsString()
  public_name!: string;

  @IsArray()
  modality!: string[];

  @IsObject()
  capabilities!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => ModelLifecycleDto)
  lifecycle!: ModelLifecycleDto;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class ModelProviderDto {
  @IsString()
  name!: string;
}

export class ModelRegionsResidencyDto {
  @IsBoolean()
  in_region_processing!: boolean;

  @IsBoolean()
  cross_region_fallback!: boolean;
}

export class ModelRegionsDto {
  @IsArray()
  available_regions!: string[];

  @IsObject()
  data_residency!: Record<string, ModelRegionsResidencyDto>;
}

export class ModelEffectiveSupportsDto {
  @IsBoolean()
  streaming!: boolean;

  @IsBoolean()
  tools!: boolean;

  @IsBoolean()
  json_schema!: boolean;

  @IsBoolean()
  vision!: boolean;

  @IsBoolean()
  audio_in!: boolean;

  @IsBoolean()
  audio_out!: boolean;
}

export class ModelPricingUnitDto {
  @IsNumber()
  input_per_1k!: number;

  @IsNumber()
  output_per_1k!: number;
}

export class ModelPricingSummaryDto {
  @IsString()
  currency!: string;

  @IsString()
  billing_model!: string;

  @IsString()
  version!: string;

  @ValidateNested()
  @Type(() => ModelPricingUnitDto)
  unit_prices!: ModelPricingUnitDto;
}

export class ModelRolloutDto {
  @IsString()
  type!: string;

  @IsNumber()
  percentage!: number;

  @IsString()
  sticky_key!: string;
}

export class ModelRoutingWeightsDto {
  @IsNumber()
  base_weight!: number;

  @IsNumber()
  quality_weight!: number;

  @IsNumber()
  cost_weight!: number;

  @IsNumber()
  latency_weight!: number;
}

export class ModelRoutingDto {
  @ValidateNested()
  @Type(() => ModelRoutingWeightsDto)
  weights!: ModelRoutingWeightsDto;
}

export class ModelHealthDto {
  @IsString()
  status!: string;

  @IsNumber()
  score!: number;

  @IsNumber()
  error_rate!: number;

  @IsNumber()
  p95_latency_ms!: number;

  @IsOptional()
  @IsString()
  cooldown_until?: string | null;
}

export class ModelVariantDto {
  @IsString()
  id!: string;

  @ValidateNested()
  @Type(() => ModelProviderDto)
  provider!: ModelProviderDto;

  @IsString()
  provider_model!: string;

  @ValidateNested()
  @Type(() => ModelRegionsDto)
  regions!: ModelRegionsDto;

  @ValidateNested()
  @Type(() => ModelEffectiveSupportsDto)
  effective_supports!: ModelEffectiveSupportsDto;

  @ValidateNested()
  @Type(() => ModelPricingSummaryDto)
  pricing_summary!: ModelPricingSummaryDto;

  @IsBoolean()
  enabled!: boolean;

  @ValidateNested()
  @Type(() => ModelRolloutDto)
  rollout!: ModelRolloutDto;

  @ValidateNested()
  @Type(() => ModelRoutingDto)
  routing!: ModelRoutingDto;

  @ValidateNested()
  @Type(() => ModelHealthDto)
  health!: ModelHealthDto;

  @IsString()
  last_updated!: string;
}

export class ModelRecommendedDefaultDto {
  @IsOptional()
  @IsString()
  variant_id?: string | null;

  @IsOptional()
  @IsString()
  provider?: string | null;

  @IsOptional()
  @IsString()
  region?: string | null;

  @IsString()
  reason!: string;
}

export class ModelAggregateDto {
  @ValidateNested()
  @Type(() => ModelPublicDto)
  public_model!: ModelPublicDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelVariantDto)
  variants!: ModelVariantDto[];

  @ValidateNested()
  @Type(() => ModelRecommendedDefaultDto)
  recommended_default!: ModelRecommendedDefaultDto;
}

export class ModelAggregateMetaDto {
  @IsString()
  generated_at!: string;

  @IsString()
  default_routing_strategy!: string;
}

export class ModelAggregatesResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModelAggregateDto)
  data!: ModelAggregateDto[];

  @ValidateNested()
  @Type(() => ModelAggregateMetaDto)
  meta!: ModelAggregateMetaDto;
}
