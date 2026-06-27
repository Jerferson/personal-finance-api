import { Module } from '@nestjs/common';
import { LedgerAccountsService } from './ledger-accounts.service';
import { LedgerAccountsController } from './ledger-accounts.controller';

@Module({
  controllers: [LedgerAccountsController],
  providers: [LedgerAccountsService],
})
export class LedgerAccountsModule {}
