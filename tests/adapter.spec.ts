import { MockProvider } from '../src/providers/mock.provider';
import { UnifiedRequest } from '../src/core/unified-schema/types';

describe('ProviderAdapter', () => {
  it('returns unified response from mock provider', async () => {
    const provider = new MockProvider();
    const request: UnifiedRequest = {
      model: 'mock-tiny',
      input: { prompt: 'hello' },
    };

    const result = await provider.generate(request, 'req_test', 'mock-tiny');
    expect(result.response.outputs[0]?.message?.content[0]).toEqual(
      expect.objectContaining({ type: 'text' }),
    );
  });
});
