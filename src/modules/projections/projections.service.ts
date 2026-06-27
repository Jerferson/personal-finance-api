import { Injectable } from '@nestjs/common';
import { ScheduledBillStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerBalanceService } from '../ledger/ledger-balance.service';
import { InvalidDateFormatError } from '../../common/errors/domain.errors';
import { parseDate } from '../../common/utils/dates';
import { BudgetProjectionQueryDto } from './dto/budget-projection-query.dto';

export interface AccountProjection {
  accountId: string;
  accountName: string;
  currentBalance: Decimal;
  scheduledIncome: Decimal;
  scheduledExpenses: Decimal;
  projectedBalance: Decimal;
}

export interface BudgetProjectionResponse {
  until: string;
  currentBalance: Decimal;
  scheduledIncome: Decimal;
  scheduledExpenses: Decimal;
  projectedBalance: Decimal;
  accounts: AccountProjection[];
}

@Injectable()
export class ProjectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerBalanceService: LedgerBalanceService,
  ) {}

  async getBudgetProjection(
    query: BudgetProjectionQueryDto,
  ): Promise<BudgetProjectionResponse> {
    const { until, accountId } = query;

    // Validate the until date
    let untilDate: Date;
    try {
      untilDate = parseDate(until);
    } catch {
      throw new InvalidDateFormatError();
    }

    // Fetch accounts (all or specific)
    const accounts = await this.prisma.account.findMany({
      where: accountId ? { id: accountId } : undefined,
      orderBy: { name: 'asc' },
    });

    // Fetch scheduled bills for those accounts
    const accountIds = accounts.map((a) => a.id);
    const scheduledBills = await this.prisma.scheduledBill.findMany({
      where: {
        status: ScheduledBillStatus.SCHEDULED,
        dueDate: { lte: untilDate },
        accountId: { in: accountIds },
      },
    });

    // Build a lookup of scheduled bills by accountId
    const billsByAccount = new Map<
      string,
      { income: Decimal; expenses: Decimal }
    >();
    for (const id of accountIds) {
      billsByAccount.set(id, {
        income: new Decimal(0),
        expenses: new Decimal(0),
      });
    }
    for (const bill of scheduledBills) {
      const entry = billsByAccount.get(bill.accountId)!;
      if (bill.type === TransactionType.INCOME) {
        entry.income = entry.income.add(bill.amount);
      } else {
        entry.expenses = entry.expenses.add(bill.amount);
      }
    }

    // Compute per-account projections (balance calculations in parallel)
    const accountProjections: AccountProjection[] = await Promise.all(
      accounts.map(async (account) => {
        const balanceResult = await this.ledgerBalanceService.calculate(
          account.id,
        );
        const currentBalance = balanceResult.balance;
        const { income: scheduledIncome, expenses: scheduledExpenses } =
          billsByAccount.get(account.id)!;
        const projectedBalance = currentBalance
          .add(scheduledIncome)
          .sub(scheduledExpenses);

        return {
          accountId: account.id,
          accountName: account.name,
          currentBalance,
          scheduledIncome,
          scheduledExpenses,
          projectedBalance,
        };
      }),
    );

    // Compute root-level totals
    const totalCurrentBalance = accountProjections.reduce(
      (acc, a) => acc.add(a.currentBalance),
      new Decimal(0),
    );
    const totalScheduledIncome = accountProjections.reduce(
      (acc, a) => acc.add(a.scheduledIncome),
      new Decimal(0),
    );
    const totalScheduledExpenses = accountProjections.reduce(
      (acc, a) => acc.add(a.scheduledExpenses),
      new Decimal(0),
    );
    const totalProjectedBalance = accountProjections.reduce(
      (acc, a) => acc.add(a.projectedBalance),
      new Decimal(0),
    );

    return {
      until,
      currentBalance: totalCurrentBalance,
      scheduledIncome: totalScheduledIncome,
      scheduledExpenses: totalScheduledExpenses,
      projectedBalance: totalProjectedBalance,
      accounts: accountProjections,
    };
  }
}
