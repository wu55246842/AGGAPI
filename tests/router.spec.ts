import { RouterService } from '../src/core/router/router.service';
import { UnifiedRequest } from '../src/core/unified-schema/types';
import { ModelCapabilities, ModelPrice, ModelRegions, ModelRouting } from '../src/modules/models/model.types';

describe('RouterService', () => {
  const capabilities: ModelCapabilities = {
    modality: ['text'],
    context_window: 32000,
    max_output_tokens: 2048,
    supports: {
      streaming: true,
      tools: true,
      tool_choice: true,
      json_schema: true,
      structured_output: true,
      vision: false,
      audio_in: false,
      audio_out: false,
      embeddings: false,
    },
    constraints: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      seed: { supported: true },
    },
    input_formats: { messages: true, prompt: true, content_parts: ['text'] },
    tooling: { max_tools: 32, max_tool_output_tokens: 512, parallel_tool_calls: true },
    quality_tier: 'premium',
  };

  const priceCheap: ModelPrice = {
    currency: 'USD',
    version: '2024-09-01',
    billing_model: 'token',
    unit_prices: { input_per_1k: 1, output_per_1k: 1 },
    minimums: { request_usd: 0 },
    rounding: { mode: 'ceil', granularity_tokens: 1 },
    discounts: { cached_input_per_1k: 0 },
  };

  const priceExpensive: ModelPrice = {
    currency: 'USD',
    version: '2024-09-01',
    billing_model: 'token',
    unit_prices: { input_per_1k: 5, output_per_1k: 15 },
    minimums: { request_usd: 0 },
    rounding: { mode: 'ceil', granularity_tokens: 1 },
    discounts: { cached_input_per_1k: 0 },
  };

  const regions: ModelRegions = {
    available_regions: ['US'],
    data_residency: { US: { in_region_processing: true, cross_region_fallback: true } },
  };

  const routing: ModelRouting = {
    enabled: true,
    rollout: { type: 'percentage', percentage: 100, sticky_key: 'api_key_prefix' },
    targeting: { allow_tenants: [], deny_tenants: [], allow_projects: [], require_tags: [] },
    weights: { base_weight: 1, quality_weight: 1, cost_weight: 1, latency_weight: 1 },
    health: {
      enabled: true,
      circuit_breaker: { failure_rate_threshold: 0.5, min_requests: 5, cooldown_seconds: 60 },
      penalties: {
        p95_latency_ms: { threshold: 1000, multiplier: 0.5 },
        error_rate: { threshold: 0.2, multiplier: 0.5 },
      },
    },
  };

  it('selects cheapest provider when strategy=cost', async () => {
    const modelsService = {
      getPublicModelWithVariants: jest.fn().mockResolvedValue({
        enabled: true,
        publicName: 'gpt-4.1',
        capabilitiesJson: capabilities,
        variants: [
          {
            id: 'v1',
            provider: 'openai',
            providerModel: 'gpt-4.1',
            enabled: true,
            priceJson: priceExpensive,
            regionsJson: regions,
            routingJson: routing,
            capabilitiesOverride: null,
          },
          {
            id: 'v2',
            provider: 'mock',
            providerModel: 'mock-gpt-4.1',
            enabled: true,
            priceJson: priceCheap,
            regionsJson: regions,
            routingJson: routing,
            capabilitiesOverride: null,
          },
        ],
      }),
    } as any;
    const healthService = {
      getSnapshot: jest.fn().mockResolvedValue({
        requests: 10,
        errors: 0,
        error_rate: 0,
        p95_latency_ms: 100,
        multiplier: 1,
        circuit_open: false,
      }),
    } as any;
    const router = new RouterService(modelsService, healthService);
    const request: UnifiedRequest = {
      model: 'gpt-4.1',
      input: { prompt: 'hello' },
      constraints: { routing: { strategy: 'cost' } },
    };

    const decision = await router.route(request, {
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyPrefix: 'key',
    });
    expect(decision.primary.provider).toBe('mock');
  });

  it('filters by required capabilities', async () => {
    const modelsService = {
      getPublicModelWithVariants: jest.fn().mockResolvedValue({
        enabled: true,
        publicName: 'gpt-4.1',
        capabilitiesJson: capabilities,
        variants: [
          {
            id: 'v1',
            provider: 'openai',
            providerModel: 'gpt-4.1',
            enabled: true,
            priceJson: priceExpensive,
            regionsJson: regions,
            routingJson: routing,
            capabilitiesOverride: { supports: { json_schema: false } },
          },
          {
            id: 'v2',
            provider: 'mock',
            providerModel: 'mock-gpt-4.1',
            enabled: true,
            priceJson: priceCheap,
            regionsJson: regions,
            routingJson: routing,
            capabilitiesOverride: null,
          },
        ],
      }),
    } as any;
    const healthService = {
      getSnapshot: jest.fn().mockResolvedValue({
        requests: 10,
        errors: 0,
        error_rate: 0,
        p95_latency_ms: 100,
        multiplier: 1,
        circuit_open: false,
      }),
    } as any;
    const router = new RouterService(modelsService, healthService);
    const request: UnifiedRequest = {
      model: 'gpt-4.1',
      input: { prompt: 'hello' },
      generation: { response_format: { type: 'json_schema' } },
    };

    const decision = await router.route(request, {
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyPrefix: 'key',
    });
    expect(decision.primary.provider).toBe('mock');
  });
});
