import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const baseRouting = {
  enabled: true,
  rollout: { type: 'percentage', percentage: 100, sticky_key: 'api_key_prefix' },
  targeting: { allow_tenants: [], deny_tenants: [], allow_projects: [], require_tags: [] },
  weights: {
    base_weight: 1,
    quality_weight: 1,
    cost_weight: 1,
    latency_weight: 1,
  },
  health: {
    enabled: true,
    circuit_breaker: { failure_rate_threshold: 0.2, min_requests: 20, cooldown_seconds: 120 },
    penalties: {
      p95_latency_ms: { threshold: 1500, multiplier: 0.5 },
      error_rate: { threshold: 0.1, multiplier: 0.4 },
    },
  },
};

const gptCapabilities = {
  modality: ['text', 'multimodal'],
  context_window: 128000,
  max_output_tokens: 8192,
  supports: {
    streaming: true,
    tools: true,
    tool_choice: true,
    json_schema: true,
    structured_output: true,
    vision: true,
    audio_in: false,
    audio_out: false,
    embeddings: false,
  },
  constraints: {
    temperature: { min: 0, max: 2, default: 1 },
    top_p: { min: 0, max: 1, default: 1 },
    seed: { supported: true },
  },
  input_formats: { messages: true, prompt: true, content_parts: ['text', 'image_url'] },
  tooling: { max_tools: 128, max_tool_output_tokens: 2048, parallel_tool_calls: true },
  quality_tier: 'premium',
};

const claudeCapabilities = {
  modality: ['text', 'multimodal'],
  context_window: 200000,
  max_output_tokens: 4096,
  supports: {
    streaming: true,
    tools: true,
    tool_choice: true,
    json_schema: true,
    structured_output: true,
    vision: true,
    audio_in: false,
    audio_out: false,
    embeddings: false,
  },
  constraints: {
    temperature: { min: 0, max: 1, default: 0.7 },
    top_p: { min: 0, max: 1, default: 0.9 },
    seed: { supported: false },
  },
  input_formats: { messages: true, prompt: true, content_parts: ['text', 'image_url'] },
  tooling: { max_tools: 64, max_tool_output_tokens: 1024, parallel_tool_calls: true },
  quality_tier: 'standard',
};

const gptPrice = {
  currency: 'USD',
  version: '2024-09-01',
  billing_model: 'token',
  unit_prices: { input_per_1k: 5, output_per_1k: 15 },
  minimums: { request_usd: 0.01 },
  rounding: { mode: 'ceil', granularity_tokens: 1 },
  discounts: { cached_input_per_1k: 0 },
};

const gptMockPrice = {
  currency: 'USD',
  version: '2024-09-01',
  billing_model: 'token',
  unit_prices: { input_per_1k: 0.05, output_per_1k: 0.05 },
  minimums: { request_usd: 0 },
  rounding: { mode: 'round', granularity_tokens: 1 },
  discounts: { cached_input_per_1k: 0 },
};

const claudePrice = {
  currency: 'USD',
  version: '2024-09-01',
  billing_model: 'token',
  unit_prices: { input_per_1k: 3, output_per_1k: 15 },
  minimums: { request_usd: 0.01 },
  rounding: { mode: 'ceil', granularity_tokens: 1 },
  discounts: { cached_input_per_1k: 0 },
};

const claudeMockPrice = {
  currency: 'USD',
  version: '2024-09-01',
  billing_model: 'token',
  unit_prices: { input_per_1k: 0.08, output_per_1k: 0.08 },
  minimums: { request_usd: 0 },
  rounding: { mode: 'round', granularity_tokens: 1 },
  discounts: { cached_input_per_1k: 0 },
};

const gptRegions = {
  available_regions: ['US', 'EU', 'SG'],
  data_residency: {
    US: { in_region_processing: true, cross_region_fallback: true },
    EU: { in_region_processing: true, cross_region_fallback: false },
    SG: { in_region_processing: true, cross_region_fallback: false },
  },
};

const claudeRegions = {
  available_regions: ['US', 'EU', 'SG'],
  data_residency: {
    US: { in_region_processing: true, cross_region_fallback: true },
    EU: { in_region_processing: true, cross_region_fallback: false },
    SG: { in_region_processing: true, cross_region_fallback: false },
  },
};

const mockRegions = {
  available_regions: ['LOCAL'],
  data_residency: {
    LOCAL: { in_region_processing: true, cross_region_fallback: true },
  },
};

async function main() {
  const gptModel = await prisma.publicModel.upsert({
    where: { publicName: 'gpt-4.1' },
    update: { capabilitiesJson: gptCapabilities, enabled: true },
    create: {
      publicName: 'gpt-4.1',
      description: 'OpenAI GPT-4.1 family',
      capabilitiesJson: gptCapabilities,
      enabled: true,
    },
  });

  const claudeModel = await prisma.publicModel.upsert({
    where: { publicName: 'claude-3.5-sonnet' },
    update: { capabilitiesJson: claudeCapabilities, enabled: true },
    create: {
      publicName: 'claude-3.5-sonnet',
      description: 'Anthropic Claude 3.5 Sonnet',
      capabilitiesJson: claudeCapabilities,
      enabled: true,
    },
  });

  await prisma.modelVariant.upsert({
    where: {
      publicModelId_provider_providerModel: {
        publicModelId: gptModel.id,
        provider: 'openai',
        providerModel: 'gpt-4.1',
      },
    },
    update: {
      priceJson: gptPrice,
      regionsJson: gptRegions,
      routingJson: baseRouting,
      enabled: true,
    },
    create: {
      publicModelId: gptModel.id,
      provider: 'openai',
      providerModel: 'gpt-4.1',
      priceJson: gptPrice,
      regionsJson: gptRegions,
      routingJson: baseRouting,
      enabled: true,
    },
  });

  await prisma.modelVariant.upsert({
    where: {
      publicModelId_provider_providerModel: {
        publicModelId: gptModel.id,
        provider: 'mock',
        providerModel: 'mock-gpt-4.1',
      },
    },
    update: {
      priceJson: gptMockPrice,
      regionsJson: mockRegions,
      routingJson: {
        ...baseRouting,
        rollout: { type: 'percentage', percentage: 10, sticky_key: 'api_key_prefix' },
      },
      capabilitiesOverride: { supports: { streaming: false, tools: false, json_schema: false } },
      enabled: true,
    },
    create: {
      publicModelId: gptModel.id,
      provider: 'mock',
      providerModel: 'mock-gpt-4.1',
      priceJson: gptMockPrice,
      regionsJson: mockRegions,
      routingJson: {
        ...baseRouting,
        rollout: { type: 'percentage', percentage: 10, sticky_key: 'api_key_prefix' },
      },
      capabilitiesOverride: { supports: { streaming: false, tools: false, json_schema: false } },
      enabled: true,
    },
  });

  await prisma.modelVariant.upsert({
    where: {
      publicModelId_provider_providerModel: {
        publicModelId: claudeModel.id,
        provider: 'anthropic',
        providerModel: 'claude-3-5-sonnet-20240620',
      },
    },
    update: {
      priceJson: claudePrice,
      regionsJson: claudeRegions,
      routingJson: baseRouting,
      enabled: true,
    },
    create: {
      publicModelId: claudeModel.id,
      provider: 'anthropic',
      providerModel: 'claude-3-5-sonnet-20240620',
      priceJson: claudePrice,
      regionsJson: claudeRegions,
      routingJson: baseRouting,
      enabled: true,
    },
  });

  await prisma.modelVariant.upsert({
    where: {
      publicModelId_provider_providerModel: {
        publicModelId: claudeModel.id,
        provider: 'mock',
        providerModel: 'mock-claude-3.5-sonnet',
      },
    },
    update: {
      priceJson: claudeMockPrice,
      regionsJson: mockRegions,
      routingJson: {
        ...baseRouting,
        rollout: { type: 'percentage', percentage: 15, sticky_key: 'api_key_prefix' },
      },
      capabilitiesOverride: { supports: { json_schema: false, tool_choice: false } },
      enabled: true,
    },
    create: {
      publicModelId: claudeModel.id,
      provider: 'mock',
      providerModel: 'mock-claude-3.5-sonnet',
      priceJson: claudeMockPrice,
      regionsJson: mockRegions,
      routingJson: {
        ...baseRouting,
        rollout: { type: 'percentage', percentage: 15, sticky_key: 'api_key_prefix' },
      },
      capabilitiesOverride: { supports: { json_schema: false, tool_choice: false } },
      enabled: true,
    },
  });
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
