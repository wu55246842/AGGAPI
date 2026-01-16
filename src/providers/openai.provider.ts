import { ProviderAdapter, ProviderResult } from './provider.interface';
import { UnifiedRequest, UnifiedResponse, SSEEvent, UnifiedMessage } from '../core/unified-schema/types';

const mapMessages = (messages: UnifiedMessage[] | undefined, prompt?: string) => {
  if (messages?.length) {
    return messages.map((message) => ({
      role: message.role,
      content: message.content.map((part) => ('text' in part ? part.text : '')).join(' '),
      name: message.name,
    }));
  }
  return prompt ? [{ role: 'user', content: prompt }] : [];
};

export class OpenAIProvider implements ProviderAdapter {
  name = 'openai';

  async generate(request: UnifiedRequest, requestId: string, providerModel: string): Promise<ProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key missing');
    }

    const body = {
      model: providerModel,
      messages: mapMessages(request.input.messages, request.input.prompt),
      temperature: request.generation?.temperature,
      max_tokens: request.generation?.max_output_tokens,
      top_p: request.generation?.top_p,
      stream: false,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`OpenAI error ${response.status}: ${errorBody}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    const choice = payload.choices?.[0];
    const messageText = choice?.message?.content ?? '';

    const unified: UnifiedResponse = {
      id: payload.id ?? `resp_openai_${Date.now()}`,
      object: 'response',
      created: payload.created ?? Math.floor(Date.now() / 1000),
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
        input_tokens: payload.usage?.prompt_tokens ?? 0,
        output_tokens: payload.usage?.completion_tokens ?? 0,
        total_tokens: payload.usage?.total_tokens ?? 0,
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
