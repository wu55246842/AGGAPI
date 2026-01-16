export type ModelCapabilitySupports = {
  streaming: boolean;
  tools: boolean;
  tool_choice: boolean;
  json_schema: boolean;
  structured_output: boolean;
  vision: boolean;
  audio_in: boolean;
  audio_out: boolean;
  embeddings: boolean;
};

export type ModelCapabilities = {
  modality: Array<'text' | 'image' | 'video' | 'audio' | 'embedding' | 'multimodal'>;
  context_window: number;
  max_output_tokens: number;
  supports: ModelCapabilitySupports;
  constraints: {
    temperature: { min: number; max: number; default: number };
    top_p: { min: number; max: number; default: number };
    seed: { supported: boolean };
  };
  input_formats: { messages: boolean; prompt: boolean; content_parts: Array<'text' | 'image_url' | 'input_audio'> };
  tooling: { max_tools: number; max_tool_output_tokens: number; parallel_tool_calls: boolean };
  quality_tier: 'economy' | 'standard' | 'premium';
};

export type ModelPrice = {
  currency: 'USD';
  version: string;
  billing_model: 'token';
  unit_prices: { input_per_1k: number; output_per_1k: number };
  minimums: { request_usd: number };
  rounding: { mode: 'ceil' | 'floor' | 'round'; granularity_tokens: number };
  discounts: { cached_input_per_1k: number };
};

export type ModelRegions = {
  available_regions: string[];
  data_residency: Record<
    string,
    {
      in_region_processing: boolean;
      cross_region_fallback: boolean;
    }
  >;
};

export type ModelRouting = {
  enabled: boolean;
  rollout: { type: 'percentage'; percentage: number; sticky_key: 'api_key_prefix' };
  targeting: {
    allow_tenants: string[];
    deny_tenants: string[];
    allow_projects: string[];
    require_tags: string[];
  };
  weights: {
    base_weight: number;
    quality_weight: number;
    cost_weight: number;
    latency_weight: number;
  };
  health: {
    enabled: boolean;
    circuit_breaker: { failure_rate_threshold: number; min_requests: number; cooldown_seconds: number };
    penalties: {
      p95_latency_ms: { threshold: number; multiplier: number };
      error_rate: { threshold: number; multiplier: number };
    };
  };
};

export type ModelCapabilitiesOverride = {
  supports?: Partial<ModelCapabilitySupports>;
  limits?: { rpm?: number; tpm?: number };
};
