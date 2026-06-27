import { Global, Module } from '@nestjs/common';
import { JournalEntryService } from './journal-entry.service';
import { LedgerBalanceService } from './ledger-balance.service';
import { LedgerAccountService } from './ledger-account.service';

@Global()
@Module({
  providers: [JournalEntryService, LedgerBalanceService, LedgerAccountService],
  exports: [JournalEntryService, LedgerBalanceService, LedgerAccountService],
})
export class LedgerModule {}
