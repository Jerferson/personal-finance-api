import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ScheduledBillsModule } from './modules/scheduled-bills/scheduled-bills.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { JournalEntriesModule } from './modules/journal-entries/journal-entries.module';
import { LedgerAccountsModule } from './modules/ledger-accounts/ledger-accounts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ProjectionsModule } from './modules/projections/projections.module';
import { StatementModule } from './modules/statement/statement.module';

@Module({
  imports: [
    PrismaModule,
    LedgerModule,
    AccountsModule,
    CategoriesModule,
    ProjectsModule,
    TransactionsModule,
    ScheduledBillsModule,
    TransfersModule,
    JournalEntriesModule,
    LedgerAccountsModule,
    ReportsModule,
    ProjectionsModule,
    StatementModule,
  ],
})
export class AppModule {}
