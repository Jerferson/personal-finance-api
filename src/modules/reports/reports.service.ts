import { Injectable } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidDateFormatError } from '../../common/errors/domain.errors';
import {
  isValidYearMonth,
  startOfMonth,
  endOfMonth,
} from '../../common/utils/dates';
import { roundToPercent } from '../../common/utils/money';
import { MonthlyExpensesQueryDto } from './dto/monthly-expenses-query.dto';
import { MonthlySummaryQueryDto } from './dto/monthly-summary-query.dto';

export interface CategoryExpense {
  categoryId: string | null;
  categoryName: string;
  total: Decimal;
  percentage: number;
}

export interface MonthlyExpensesResponse {
  month: string;
  totalExpenses: Decimal;
  categories: CategoryExpense[];
}

export interface MonthlySummaryResponse {
  month: string;
  totalIncome: Decimal;
  totalExpense: Decimal;
  netAmount: Decimal;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyExpenses(
    query: MonthlyExpensesQueryDto,
  ): Promise<MonthlyExpensesResponse> {
    const { month, accountId } = query;

    if (!isValidYearMonth(month)) {
      throw new InvalidDateFormatError();
    }

    const start = startOfMonth(month);
    const end = endOfMonth(month);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.POSTED,
        type: TransactionType.EXPENSE,
        transactionDate: { gte: start, lte: end },
        ...(accountId && { accountId }),
      },
      include: {
        category: true,
      },
    });

    // Group by categoryId
    const grouped = new Map<
      string | null,
      { categoryId: string | null; categoryName: string; total: Decimal }
    >();

    for (const tx of transactions) {
      const key = tx.categoryId ?? null;
      const name = tx.category?.name ?? 'Uncategorized';

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.total = existing.total.add(tx.amount);
      } else {
        grouped.set(key, {
          categoryId: key,
          categoryName: name,
          total: new Decimal(tx.amount),
        });
      }
    }

    const totalExpenses = Array.from(grouped.values()).reduce(
      (acc, g) => acc.add(g.total),
      new Decimal(0),
    );

    const categories: CategoryExpense[] = Array.from(grouped.values())
      .map((g) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        total: g.total,
        percentage: roundToPercent(g.total, totalExpenses),
      }))
      .sort((a, b) => b.total.comparedTo(a.total));

    return {
      month,
      totalExpenses,
      categories,
    };
  }

  async getMonthlySummary(
    query: MonthlySummaryQueryDto,
  ): Promise<MonthlySummaryResponse> {
    const { month, accountId } = query;

    if (!isValidYearMonth(month)) {
      throw new InvalidDateFormatError();
    }

    const start = startOfMonth(month);
    const end = endOfMonth(month);

    const baseWhere = {
      status: TransactionStatus.POSTED,
      transactionDate: { gte: start, lte: end },
      ...(accountId && { accountId }),
    };

    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: TransactionType.INCOME },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: TransactionType.EXPENSE },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? new Decimal(0);
    const totalExpense = expenseAgg._sum.amount ?? new Decimal(0);
    const netAmount = new Decimal(totalIncome).sub(new Decimal(totalExpense));

    return {
      month,
      totalIncome: new Decimal(totalIncome),
      totalExpense: new Decimal(totalExpense),
      netAmount,
    };
  }
}
