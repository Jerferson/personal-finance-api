import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

export interface AccountBalance {
  accountId: string;
  accountName: string;
  date: string;
  initialBalance: Decimal;
  totalDebits: Decimal;
  totalCredits: Decimal;
  balance: Decimal;
}

@Injectable()
export class LedgerBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(accountId: string, date?: Date): Promise<AccountBalance> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { ledgerAccount: true },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const dateFilter = date ? { lte: date } : undefined;

    // Aggregate debits and credits from posted journal lines for the account's ledger account
    const aggregate = await this.prisma.journalLine.aggregate({
      where: {
        ledgerAccountId: account.ledgerAccountId,
        journalEntry: {
          status: 'POSTED',
          ...(dateFilter ? { entryDate: dateFilter } : {}),
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebits = aggregate._sum.debit ?? new Decimal(0);
    const totalCredits = aggregate._sum.credit ?? new Decimal(0);
    // All supported accounts are ASSET: balance = initialBalance + debits - credits
    const balance = new Decimal(account.initialBalance).add(totalDebits).sub(totalCredits);

    const resolvedDate = date ?? new Date();
    const dateStr = resolvedDate.toISOString().split('T')[0];

    return {
      accountId: account.id,
      accountName: account.name,
      date: dateStr,
      initialBalance: new Decimal(account.initialBalance),
      totalDebits,
      totalCredits,
      balance,
    };
  }

  async calculateCurrentBalance(accountId: string): Promise<Decimal> {
    const result = await this.calculate(accountId);
    return result.balance;
  }
}
