import { calculateCostUsd } from '../src/modules/usage/billing';
import { MODEL_CATALOG } from '../src/modules/models/catalog';

describe('Billing', () => {
  it('calculates cost based on pricing table', () => {
    const model = MODEL_CATALOG.find((entry) => entry.publicName === 'gpt-4.1' && entry.provider === 'openai');
    const cost = calculateCostUsd(model, 1000, 2000);
    expect(cost).toBeCloseTo(35, 5);
  });
});
