import { ModelCatalogEntry } from '../models/catalog';

export const calculateCostUsd = (
  model: ModelCatalogEntry | undefined,
  inputTokens: number,
  outputTokens: number,
) => {
  if (!model) {
    return 0;
  }
  return (
    (inputTokens / 1000) * model.pricing.input_per_1k +
    (outputTokens / 1000) * model.pricing.output_per_1k
  );
};
