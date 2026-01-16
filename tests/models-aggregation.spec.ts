import { ModelsCatalogService } from '../src/core/catalog/models-catalog.service';
import { ModelsHealthService } from '../src/core/health/models-health.service';
import { HealthService } from '../src/core/router/health.service';
import { ModelCapabilities, ModelRouting } from '../src/modules/models/model.types';

describe('Models aggregation helpers', () => {
  const baseCapabilities: ModelCapabilities = {
    modality: ['text'],
    context_window: 128000,
    max_output_tokens: 4096,
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
      seed: { supported: false },
    },
    input_formats: { messages: true, prompt: false, content_parts: ['text'] },
    tooling: { max_tools: 10, max_tool_output_tokens: 1024, parallel_tool_calls: true },
    quality_tier: 'standard',
  };

  it('merges effective supports with overrides', () => {
    const catalog = new ModelsCatalogService();
    const effective = catalog.buildEffectiveSupports(baseCapabilities, {
      supports: { vision: true, tools: false },
    });

    expect(effective.vision).toBe(true);
    expect(effective.tools).toBe(false);
    expect(effective.streaming).toBe(true);
  });

  it('selects recommended default using static weights and pricing', () => {
    const catalog = new ModelsCatalogService();
    const recommended = catalog.recommendDefault({
      id: 'pm_1',
      publicName: 'gpt-4.1',
      enabled: true,
      capabilitiesJson: baseCapabilities,
      variants: [
        {
          id: 'mv_expensive',
          provider: 'openai',
          providerModel: 'gpt-4.1',
          enabled: true,
          priceJson: {
            currency: 'USD',
            version: '2026-01-01',
            billing_model: 'token',
            unit_prices: { input_per_1k: 0.02, output_per_1k: 0.03 },
            minimums: { request_usd: 0 },
            rounding: { mode: 'round', granularity_tokens: 1 },
            discounts: { cached_input_per_1k: 0 },
          },
          regionsJson: {
            available_regions: ['US', 'SG'],
            data_residency: {
              US: { in_region_processing: true, cross_region_fallback: true },
            },
          },
          routingJson: {
            enabled: true,
            rollout: { type: 'percentage', percentage: 100, sticky_key: 'api_key_prefix' },
            targeting: { allow_tenants: [], deny_tenants: [], allow_projects: [], require_tags: [] },
            weights: { base_weight: 100, quality_weight: 1, cost_weight: 1, latency_weight: 1 },
            health: {
              enabled: true,
              circuit_breaker: { failure_rate_threshold: 0.3, min_requests: 10, cooldown_seconds: 60 },
              penalties: {
                p95_latency_ms: { threshold: 800, multiplier: 0.5 },
                error_rate: { threshold: 0.1, multiplier: 0.7 },
              },
            },
          },
          capabilitiesOverride: { supports: { vision: true } },
          updatedAt: new Date(),
        },
        {
          id: 'mv_budget',
          provider: 'openai',
          providerModel: 'gpt-4.1-mini',
          enabled: true,
          priceJson: {
            currency: 'USD',
            version: '2026-01-01',
            billing_model: 'token',
            unit_prices: { input_per_1k: 0.002, output_per_1k: 0.003 },
            minimums: { request_usd: 0 },
            rounding: { mode: 'round', granularity_tokens: 1 },
            discounts: { cached_input_per_1k: 0 },
          },
          regionsJson: {
            available_regions: ['SG'],
            data_residency: {
              SG: { in_region_processing: true, cross_region_fallback: false },
            },
          },
          routingJson: {
            enabled: true,
            rollout: { type: 'percentage', percentage: 100, sticky_key: 'api_key_prefix' },
            targeting: { allow_tenants: [], deny_tenants: [], allow_projects: [], require_tags: [] },
            weights: { base_weight: 100, quality_weight: 1, cost_weight: 2, latency_weight: 1 },
            health: {
              enabled: true,
              circuit_breaker: { failure_rate_threshold: 0.3, min_requests: 10, cooldown_seconds: 60 },
              penalties: {
                p95_latency_ms: { threshold: 800, multiplier: 0.5 },
                error_rate: { threshold: 0.1, multiplier: 0.7 },
              },
            },
          },
          capabilitiesOverride: { supports: { vision: true } },
          updatedAt: new Date(),
        },
      ],
    });

    expect(recommended.variant_id).toBe('mv_budget');
    expect(recommended.reason).toContain('router_estimate');
  });

  it('returns unknown health when no data is available', async () => {
    const mockHealth = {
      getSnapshot: jest.fn().mockResolvedValue({
        requests: 0,
        errors: 0,
        error_rate: 0,
        p95_latency_ms: 0,
        multiplier: 1,
        circuit_open: false,
      }),
      getCooldownUntil: jest.fn().mockResolvedValue(null),
    } as unknown as HealthService;
    const healthService = new ModelsHealthService(mockHealth);
    const routingHealth: ModelRouting['health'] = {
      enabled: true,
      circuit_breaker: { failure_rate_threshold: 0.3, min_requests: 10, cooldown_seconds: 60 },
      penalties: {
        p95_latency_ms: { threshold: 800, multiplier: 0.5 },
        error_rate: { threshold: 0.1, multiplier: 0.7 },
      },
    };

    const health = await healthService.getVariantHealth('mv_1', routingHealth, 5);

    expect(health.status).toBe('unknown');
    expect(health.cooldown_until).toBeNull();
  });

  it('disables variants when public model is disabled', () => {
    const catalog = new ModelsCatalogService();
    expect(catalog.computeVariantEnabled(false, true, true)).toBe(false);
  });
});
