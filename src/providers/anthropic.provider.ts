import { ProviderAdapter, ProviderResult } from './provider.interface';
import { UnifiedRequest, UnifiedResponse, SSEEvent, UnifiedMessage } from '../core/unified-schema/types';

const mapMessages = (messages: UnifiedMessage[] | undefined, prompt?: string) => {
  if (messages?.length) {
    return messages.map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content.map((part) => ('text' in part ? part.text : '')).join(' '),
    }));
  }
  return prompt ? [{ role: 'user', content: prompt }] : [];
};

export class AnthropicProvider implements ProviderAdapter {
  name = 'anthropic';

  async generate(request: UnifiedRequest, requestId: string, providerModel: string): Promise<ProviderResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key missing');
    }

    const body = {
      model: providerModel,
      max_tokens: request.generation?.max_output_tokens ?? 512,
      temperature: request.generation?.temperature,
      top_p: request.generation?.top_p,
      messages: mapMessages(request.input.messages, request.input.prompt),
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`Anthropic error ${response.status}: ${errorBody}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    const messageText = payload.content?.map((part: any) => part.text).join('') ?? '';

    const unified: UnifiedResponse = {
      id: payload.id ?? `resp_anthropic_${Date.now()}`,
      object: 'response',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      provider: { name: this.name, model: providerModel },
      outputs: [
        {
          type: 'message',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: messageText }],
          },
        },
      ],
      request_id: requestId,
      metadata: request.metadata,
      usage: {
        input_tokens: payload.usage?.input_tokens ?? 0,
        output_tokens: payload.usage?.output_tokens ?? 0,
        total_tokens: (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0),
        cost_usd: 0,
      },
    };

    return {
      response: unified,
      usage: unified.usage!,
    };
  }

  async *stream(request: UnifiedRequest, requestId: string, providerModel: string): AsyncGenerator<SSEEvent, ProviderResult, void> {
    yield { type: 'response.created', data: { request_id: requestId } };
    const result = await this.generate(request, requestId, providerModel);
    yield { type: 'response.usage', data: result.usage };
    yield { type: 'response.completed', data: result.response };
    return result;
  }
}
