import { Injectable } from '@nestjs/common';
import { ProviderAdapter } from './provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { MockProvider } from './mock.provider';

@Injectable()
export class ProviderRegistry {
  private readonly providers: Record<string, ProviderAdapter>;

  constructor() {
    const mockProvider = new MockProvider();
    this.providers = {
      openai: process.env.MOCK_MODE === 'true' ? mockProvider : new OpenAIProvider(),
      anthropic: process.env.MOCK_MODE === 'true' ? mockProvider : new AnthropicProvider(),
      mock: mockProvider,
    };
  }

  get(providerName: string): ProviderAdapter {
    const provider = this.providers[providerName];
    if (!provider) {
      throw new Error(`Provider ${providerName} not configured`);
    }
    return provider;
  }
}
