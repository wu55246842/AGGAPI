export type ModelCatalogEntry = {
  id: string;
  publicName: string;
  provider: string;
  providerModel: string;
  modality: 'text' | 'image' | 'video' | 'audio' | 'embedding';
  capabilities: Record<string, unknown>;
  pricing: {
    input_per_1k: number;
    output_per_1k: number;
  };
  regions: string[];
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'openai-gpt-4.1',
    publicName: 'gpt-4.1',
    provider: 'openai',
    providerModel: 'gpt-4.1',
    modality: 'text',
    capabilities: { tools: true, json_schema: true },
    pricing: { input_per_1k: 5, output_per_1k: 15 },
    regions: ['US', 'EU'],
  },
  {
    id: 'mock-gpt-4.1',
    publicName: 'gpt-4.1',
    provider: 'mock',
    providerModel: 'mock-gpt-4.1',
    modality: 'text',
    capabilities: { tools: false, json_schema: false },
    pricing: { input_per_1k: 0.05, output_per_1k: 0.05 },
    regions: ['LOCAL'],
  },
  {
    id: 'anthropic-claude-3.5-sonnet',
    publicName: 'claude-3.5-sonnet',
    provider: 'anthropic',
    providerModel: 'claude-3-5-sonnet-20240620',
    modality: 'text',
    capabilities: { tools: true, json_schema: true },
    pricing: { input_per_1k: 3, output_per_1k: 15 },
    regions: ['US', 'EU', 'SG'],
  },
  {
    id: 'mock-tiny',
    publicName: 'mock-tiny',
    provider: 'mock',
    providerModel: 'mock-tiny',
    modality: 'text',
    capabilities: { tools: false, json_schema: false },
    pricing: { input_per_1k: 0.1, output_per_1k: 0.1 },
    regions: ['LOCAL'],
  },
];
