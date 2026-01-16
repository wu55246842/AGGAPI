import { ModelPrice } from '../models/model.types';

export type CostBreakdown = {
  rounded_input_tokens: number;
  rounded_output_tokens: number;
  cached_input_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  cached_input_discount_usd: number;
  total_cost_usd: number;
};

export class CostCalculator {
  calculate(price: ModelPrice, inputTokens: number, outputTokens: number, cachedInputTokens = 0) {
    const roundedInputTokens = this.roundTokens(inputTokens, price.rounding);
    const roundedOutputTokens = this.roundTokens(outputTokens, price.rounding);
    const inputCost = (roundedInputTokens / 1000) * price.unit_prices.input_per_1k;
    const outputCost = (roundedOutputTokens / 1000) * price.unit_prices.output_per_1k;
    const cachedDiscount = (cachedInputTokens / 1000) * price.discounts.cached_input_per_1k;
    const total = Math.max(price.minimums.request_usd, inputCost + outputCost - cachedDiscount);

    return {
      cost_usd: total,
      breakdown: {
        rounded_input_tokens: roundedInputTokens,
        rounded_output_tokens: roundedOutputTokens,
        cached_input_tokens: cachedInputTokens,
        input_cost_usd: inputCost,
        output_cost_usd: outputCost,
        cached_input_discount_usd: cachedDiscount,
        total_cost_usd: total,
      },
    };
  }

  private roundTokens(tokens: number, rounding: ModelPrice['rounding']) {
    const granularity = Math.max(1, rounding.granularity_tokens);
    const raw = tokens / granularity;
    const rounded = rounding.mode === 'ceil' ? Math.ceil(raw) : rounding.mode === 'floor' ? Math.floor(raw) : Math.round(raw);
    return rounded * granularity;
  }
}
