import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyGuard } from './idempotency.guard';

@Global()
@Module({
  providers: [IdempotencyService, IdempotencyGuard],
  exports: [IdempotencyService, IdempotencyGuard],
})
export class IdempotencyModule {}
