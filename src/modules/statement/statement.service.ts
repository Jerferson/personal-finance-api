import { Injectable } from '@nestjs/common';
import { JournalEntrySourceType, Prisma, ScheduledBillStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { formatDateIso, todayUtc } from '../../common/utils/dates';
import {
  StatementEntryDto,
  StatementInitialResponseDto,
  StatementPageResponseDto,
} from './dto/statement-entry.dto';

type JournalEntryWithRelations = Prisma.JournalEntryGetPayload<{
  include: {
    transaction: { include: { account: true; category: true; project: true } };
    lines: { include: { ledgerAccount: { include: { accounts: true } } } };
  };
}>;

type ScheduledBillWithRelations = Prisma.ScheduledBillGetPayload<{
  include: { account: true; category: true; project: true };
}>;

const PAST_INCLUDE = {
  transaction: { include: { account: true, category: true, project: true } },
  lines: { include: { ledgerAccount: { include: { accounts: true } } } },
} satisfies Prisma.JournalEntryInclude;

const FUTURE_INCLUDE = {
  account: true,
  category: true,
  project: true,
} satisfies Prisma.ScheduledBillInclude;

@Injectable()
export class StatementService {
  constructor(private readonly prisma: PrismaService) {}

  async getInitial(): Promise<StatementInitialResponseDto> {
    const [futureResult, pastResult] = await Promise.all([
      this.getFuture(0, 3),
      this.getPast(0, 20),
    ]);
    return {
      future: futureResult.entries,
      past: pastResult.entries,
      hasMoreFuture: futureResult.hasMore,
      hasMorePast: pastResult.hasMore,
    };
  }

  async getPast(skip: number, limit: number): Promise<StatementPageResponseDto> {
    const raw = await this.prisma.journalEntry.findMany({
      where: {
        sourceType: {
          in: [
            JournalEntrySourceType.SIMPLE_TRANSACTION,
            JournalEntrySourceType.SCHEDULED_BILL,
            JournalEntrySourceType.TRANSFER,
          ],
        },
      },
      skip,
      take: limit + 1,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      include: PAST_INCLUDE,
    });

    const hasMore = raw.length > limit;
    const entries = raw.slice(0, limit).map(je => this.mapJournalEntry(je));
    return { entries, hasMore };
  }

  async getFuture(skip: number, limit: number): Promise<StatementPageResponseDto> {
    const today = todayUtc();
    const raw = await this.prisma.scheduledBill.findMany({
      where: {
        status: ScheduledBillStatus.SCHEDULED,
        dueDate: { gte: today },
      },
      skip,
      take: limit + 1,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: FUTURE_INCLUDE,
    });

    const hasMore = raw.length > limit;
    const entries = raw.slice(0, limit).map(bill => this.mapScheduledBill(bill));
    return { entries, hasMore };
  }

  private mapJournalEntry(je: JournalEntryWithRelations): StatementEntryDto {
    if (je.sourceType === JournalEntrySourceType.TRANSFER) {
      return this.mapTransfer(je);
    }
    return this.mapTransaction(je);
  }

  private mapTransaction(je: JournalEntryWithRelations): StatementEntryDto {
    const tx = je.transaction!;
    return {
      id: je.id,
      date: formatDateIso(je.entryDate),
      description: je.description,
      amount: tx.amount.toString(),
      type: tx.type as 'INCOME' | 'EXPENSE',
      sourceType: je.sourceType === JournalEntrySourceType.SCHEDULED_BILL ? 'SCHEDULED_BILL' : 'TRANSACTION',
      status: 'POSTED',
      isScheduled: false,
      accountId: tx.accountId,
      accountName: tx.account.name,
      categoryId: tx.categoryId,
      categoryName: tx.category.name,
      ...(tx.projectId && { projectId: tx.projectId, projectName: tx.project?.name }),
      transactionId: tx.id,
      ...(je.sourceType === JournalEntrySourceType.SCHEDULED_BILL && je.sourceId
        ? { scheduledBillId: je.sourceId }
        : {}),
    };
  }

  private mapTransfer(je: JournalEntryWithRelations): StatementEntryDto {
    const debitLine = je.lines.find(l => new Decimal(l.debit.toString()).greaterThan(0));
    const creditLine = je.lines.find(l => new Decimal(l.credit.toString()).greaterThan(0));

    const toAccount = debitLine?.ledgerAccount.accounts[0];
    const fromAccount = creditLine?.ledgerAccount.accounts[0];

    const amount = debitLine?.debit.toString() ?? '0';

    return {
      id: je.id,
      date: formatDateIso(je.entryDate),
      description: je.description,
      amount,
      type: 'TRANSFER',
      sourceType: 'TRANSFER',
      status: 'POSTED',
      isScheduled: false,
      accountId: fromAccount?.id ?? '',
      accountName: fromAccount?.name ?? 'Unknown',
      relatedAccountId: toAccount?.id,
      relatedAccountName: toAccount?.name,
    };
  }

  private mapScheduledBill(bill: ScheduledBillWithRelations): StatementEntryDto {
    return {
      id: bill.id,
      date: formatDateIso(bill.dueDate),
      description: bill.description,
      amount: bill.amount.toString(),
      type: bill.type as 'INCOME' | 'EXPENSE',
      sourceType: 'SCHEDULED_BILL',
      status: 'SCHEDULED',
      isScheduled: true,
      accountId: bill.accountId,
      accountName: bill.account.name,
      categoryId: bill.categoryId,
      categoryName: bill.category.name,
      ...(bill.projectId && { projectId: bill.projectId, projectName: bill.project?.name }),
      scheduledBillId: bill.id,
    };
  }
}
