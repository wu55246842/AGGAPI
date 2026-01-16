import { HttpException, HttpStatus } from '@nestjs/common';
import { UnifiedRequest } from './types';

export const validateUnifiedRequest = (request: UnifiedRequest) => {
  if (!request.model) {
    throw new HttpException({ code: 'BAD_REQUEST', message: 'model is required' }, HttpStatus.BAD_REQUEST);
  }
  if (!request.input || (!request.input.messages && !request.input.prompt)) {
    throw new HttpException(
      { code: 'BAD_REQUEST', message: 'input.messages or input.prompt is required' },
      HttpStatus.BAD_REQUEST,
    );
  }
};
