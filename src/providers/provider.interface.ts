import { UnifiedRequest, UnifiedResponse, SSEEvent } from '../core/unified-schema/types';

export type ProviderResult = {
  response: UnifiedResponse;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
};

export interface ProviderAdapter {
  name: string;
  generate(request: UnifiedRequest, requestId: string, providerModel: string): Promise<ProviderResult>;
  stream(
    request: UnifiedRequest,
    requestId: string,
    providerModel: string,
  ): AsyncGenerator<SSEEvent, ProviderResult, void>;
}
