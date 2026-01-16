import { ProviderAdapter, ProviderResult } from './provider.interface';
import { UnifiedRequest, UnifiedResponse, SSEEvent } from '../core/unified-schema/types';

export class MockProvider implements ProviderAdapter {
  name = 'mock';

  async generate(request: UnifiedRequest, requestId: string, providerModel: string): Promise<ProviderResult> {
    const content = request.input.prompt ?? request.input.messages?.map((m) => m.content.map((c) => ('text' in c ? c.text : '')).join(' ')).join('\n') ?? '';
    const message = `Mock response to: ${content}`.slice(0, 200);
    const response: UnifiedResponse = {
      id: `resp_mock_${Date.now()}`,
      object: 'response',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      provider: { name: this.name, model: providerModel, region: 'LOCAL' },
      outputs: [
        {
          type: 'message',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: message }],
          },
        },
      ],
      request_id: requestId,
      metadata: request.metadata,
    };
    const usage = {
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      cost_usd: 0.01,
    };
    response.usage = usage;
    return { response, usage };
  }

  async *stream(request: UnifiedRequest, requestId: string, providerModel: string): AsyncGenerator<SSEEvent, ProviderResult, void> {
    const createdEvent: SSEEvent = {
      type: 'response.created',
      data: { request_id: requestId },
    };
    yield createdEvent;

    const text = `Mock stream for ${request.model}`;
    for (const chunk of text.split(' ')) {
      yield {
        type: 'response.delta',
        data: { delta: chunk + ' ' },
      };
    }

    const result = await this.generate(request, requestId, providerModel);
    yield {
      type: 'response.usage',
      data: result.usage,
    };
    yield {
      type: 'response.completed',
      data: result.response,
    };
    return result;
  }
}
