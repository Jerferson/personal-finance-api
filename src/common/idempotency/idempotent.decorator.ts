import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  resourceType: string;
}

export const Idempotent = (resourceType: string) =>
  SetMetadata(IDEMPOTENT_KEY, { resourceType } as IdempotentOptions);
