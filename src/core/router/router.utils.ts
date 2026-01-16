import { UnifiedRequest } from '../unified-schema/types';
import { ModelCapabilities, ModelCapabilitiesOverride } from '../../modules/models/model.types';

export type RequiredCapabilities = Partial<ModelCapabilities['supports']>;

export const deriveRequiredCapabilities = (request: UnifiedRequest): RequiredCapabilities => {
  const required: RequiredCapabilities = {};
  if (request.generation?.tools?.length) {
    required.tools = true;
  }
  if (request.generation?.response_format?.type === 'json_schema') {
    required.json_schema = true;
  }
  if (request.stream) {
    required.streaming = true;
  }
  const messages = request.input.messages ?? [];
  const hasVision = messages.some((message) =>
    (message.content ?? []).some((part) => part.type === 'image_url'),
  );
  if (hasVision) {
    required.vision = true;
  }
  return required;
};

export const mergeCapabilities = (
  base: ModelCapabilities,
  override?: ModelCapabilitiesOverride | null,
): ModelCapabilities & { limits?: ModelCapabilitiesOverride['limits'] } => {
  if (!override) {
    return base;
  }
  return {
    ...base,
    supports: { ...base.supports, ...(override.supports ?? {}) },
    limits: override.limits,
  };
};

export const supportsRequiredCapabilities = (
  effective: ModelCapabilities,
  required: RequiredCapabilities,
) => {
  return Object.entries(required).every(([key, value]) => {
    if (!value) {
      return true;
    }
    return effective.supports[key as keyof ModelCapabilities['supports']] === true;
  });
};

export const hashToPercentage = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
};

export const isRolloutAllowed = (percentage: number, stickyValue: string) => {
  if (percentage >= 100) {
    return true;
  }
  if (percentage <= 0) {
    return false;
  }
  return hashToPercentage(stickyValue) < percentage;
};

export const qualityScoreForTier = (tier: ModelCapabilities['quality_tier']) => {
  switch (tier) {
    case 'premium':
      return 3;
    case 'standard':
      return 2;
    case 'economy':
    default:
      return 1;
  }
};
