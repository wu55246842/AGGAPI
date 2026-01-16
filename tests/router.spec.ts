import { RouterService } from '../src/core/router/router.service';
import { UnifiedRequest } from '../src/core/unified-schema/types';

describe('RouterService', () => {
  it('selects cheapest provider when strategy=cost', () => {
    const router = new RouterService();
    const request: UnifiedRequest = {
      model: 'gpt-4.1',
      input: { prompt: 'hello' },
      constraints: { routing: { strategy: 'cost' } },
    };

    const decision = router.route(request);
    expect(decision.provider).toBe('mock');
  });
});
