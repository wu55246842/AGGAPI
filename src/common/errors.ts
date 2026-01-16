import { HttpStatus } from '@nestjs/common';

export type ProviderError = {
  name?: string;
  status_code?: number;
  raw_code?: string;
  raw_message?: string;
};

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: Record<string, unknown>;
    provider?: ProviderError;
  };
};

export const buildError = (
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
  provider?: ProviderError,
): ErrorResponse => ({
  error: {
    code,
    message,
    request_id: requestId,
    details,
    provider,
  },
});

export const errorStatusMap: Record<string, number> = {
  AUTH_INVALID: HttpStatus.UNAUTHORIZED,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  PROVIDER_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  CAPABILITY_UNSUPPORTED: HttpStatus.BAD_REQUEST,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
};
