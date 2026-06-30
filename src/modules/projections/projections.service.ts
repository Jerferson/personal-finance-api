import { Injectable } from '@nestjs/common';
import { ScheduledBillStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerBalanceService } from '../ledger/ledger-balance.service';
import { InvalidDateFormatError } from '../../common/errors/domain.errors';
import { parseDate, formatDateIso } from '../../common/utils/dates';
import { BudgetProjectionQueryDto } from './dto/budget-projection-query.dto';
import { CashflowQueryDto } from './dto/cashflow-query.dto';

export interface MonthlyProjection {
  month: string;
  startingBalance: string;
  scheduledIncome: string;
  scheduledExpenses: string;
  projectedEndBalance: string;
}

export interface CashflowProjectionResponse {
  currentBalance: string;
  months: MonthlyProjection[];
}

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

  async getCashflowProjection(query: CashflowQueryDto): Promise<CashflowProjectionResponse> {
    const months = Math.min(query.months ?? 13, 24);

    // Total current balance across all accounts
    const accounts = await this.prisma.account.findMany();
    const accountIds = accounts.map(a => a.id);

    const balances = await Promise.all(
      accounts.map(a => this.ledgerBalanceService.calculate(a.id)),
    );
    const currentBalance = balances.reduce((acc, b) => acc.add(b.balance), new Decimal(0));

    // Fetch all SCHEDULED bills within the projection window
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const windowEnd = new Date(now.getFullYear(), now.getMonth() + months, 0);

    const bills = await this.prisma.scheduledBill.findMany({
      where: {
        accountId: { in: accountIds },
        status: ScheduledBillStatus.SCHEDULED,
        dueDate: { gte: windowStart, lte: windowEnd },
      },
    });

    // Chain projection month by month
    let runningBalance = currentBalance;
    const monthlyData: MonthlyProjection[] = [];

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthStr = formatDateIso(d).slice(0, 7); // YYYY-MM

      const monthBills = bills.filter(b => b.dueDate >= monthStart && b.dueDate <= monthEnd);

      const income = monthBills
        .filter(b => b.type === TransactionType.INCOME)
        .reduce((acc, b) => acc.add(b.amount), new Decimal(0));

      const expenses = monthBills
        .filter(b => b.type === TransactionType.EXPENSE)
        .reduce((acc, b) => acc.add(b.amount), new Decimal(0));

      const startingBalance = runningBalance;
      const projectedEndBalance = startingBalance.add(income).sub(expenses);
      runningBalance = projectedEndBalance;

      monthlyData.push({
        month: monthStr,
        startingBalance: startingBalance.toFixed(2),
        scheduledIncome: income.toFixed(2),
        scheduledExpenses: expenses.toFixed(2),
        projectedEndBalance: projectedEndBalance.toFixed(2),
      });
    }

    return {
      currentBalance: currentBalance.toFixed(2),
      months: monthlyData,
    };
  }
}
