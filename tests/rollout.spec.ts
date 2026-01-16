import { isRolloutAllowed } from '../src/core/router/router.utils';

describe('Rollout targeting', () => {
  it('allows 100% rollout and blocks 0%', () => {
    expect(isRolloutAllowed(100, 'tenant-a')).toBe(true);
    expect(isRolloutAllowed(0, 'tenant-a')).toBe(false);
  });

  it('is stable for sticky key', () => {
    const first = isRolloutAllowed(50, 'sticky-key');
    const second = isRolloutAllowed(50, 'sticky-key');
    expect(first).toBe(second);
  });
});
