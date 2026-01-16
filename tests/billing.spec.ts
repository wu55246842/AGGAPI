import { CostCalculator } from '../src/modules/usage/billing';
import { ModelPrice } from '../src/modules/models/model.types';

describe('Billing', () => {
  const calculator = new CostCalculator();
  const price: ModelPrice = {
    currency: 'USD',
    version: '2024-09-01',
    billing_model: 'token',
    unit_prices: { input_per_1k: 5, output_per_1k: 15 },
    minimums: { request_usd: 0.01 },
    rounding: { mode: 'ceil', granularity_tokens: 10 },
    discounts: { cached_input_per_1k: 1 },
  };

  it('calculates cost based on pricing table and rounding', () => {
    const result = calculator.calculate(price, 1001, 2001);
    expect(result.cost_usd).toBeCloseTo(35.2, 2);
    expect(result.breakdown.rounded_input_tokens).toBe(1010);
    expect(result.breakdown.rounded_output_tokens).toBe(2010);
  });

  it('applies request minimum', () => {
    const result = calculator.calculate(price, 1, 1);
    expect(result.cost_usd).toBe(0.01);
  });

  it('supports cached input discount', () => {
    const result = calculator.calculate(price, 1000, 0, 500);
    expect(result.breakdown.cached_input_tokens).toBe(500);
    expect(result.cost_usd).toBeCloseTo(4.5, 2);
  });
});
