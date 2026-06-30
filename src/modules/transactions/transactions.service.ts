import { Injectable } from '@nestjs/common';
import { JournalEntrySourceType, TransactionStatus, TransactionType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryService } from '../ledger/journal-entry.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import {
  AccountNotFoundException,
  CategoryNotFoundException,
  CategoryTypeMismatchError,
  InvalidAmountError,
  ProjectNotFoundException,
  TransactionNotFoundException,
} from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { parseDate, endOfDay, startOfDay } from '../../common/utils/dates';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    account: true;
    category: true;
    project: true;
    journalEntry: { include: { lines: true } };
  };
}>;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntryService: JournalEntryService,
    private readonly ledgerAccountService: LedgerAccountService,
  ) {}

  private readonly transactionInclude = {
    account: true,
    category: true,
    project: true,
    journalEntry: { include: { lines: true } },
  } satisfies Prisma.TransactionInclude;

  private async validateAmount(amount: string): Promise<Decimal> {
    const decimal = new Decimal(amount);
    if (!decimal.greaterThan(0)) throw new InvalidAmountError();
    return decimal;
  }

  private async validateAccount(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AccountNotFoundException(accountId);
  }

  private async validateCategory(categoryId: string, type: TransactionType): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new CategoryNotFoundException(categoryId);
    if (category.type !== type) throw new CategoryTypeMismatchError();
  }

  private async validateProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ProjectNotFoundException(projectId);
  }

  async create(dto: CreateTransactionDto, idempotencyKey: string): Promise<TransactionWithRelations> {
    // Return existing if already processed
    const existingJe = await this.prisma.journalEntry.findUnique({
      where: { idempotencyKey },
      include: { transaction: { include: this.transactionInclude } },
    });
    if (existingJe?.transaction) return existingJe.transaction;

    const amount = await this.validateAmount(dto.amount);
    await this.validateAccount(dto.accountId);
    await this.validateCategory(dto.categoryId, dto.type);
    if (dto.projectId) await this.validateProject(dto.projectId);

    const transactionDate = parseDate(dto.transactionDate);

    return this.prisma.$transaction(async (tx) => {
      const [expensesLedger, incomeLedger, accountLedger] = await Promise.all([
        this.ledgerAccountService.getExpensesLedgerAccount(),
        this.ledgerAccountService.getIncomeLedgerAccount(),
        this.ledgerAccountService.getAccountLedgerAccount(dto.accountId),
      ]);

      let lines: Parameters<typeof this.journalEntryService.createBalanced>[0]['lines'];

      if (dto.type === TransactionType.EXPENSE) {
        lines = [
          { ledgerAccountId: expensesLedger.id, debit: amount, credit: new Decimal(0), categoryId: dto.categoryId, projectId: dto.projectId },
          { ledgerAccountId: accountLedger.id, debit: new Decimal(0), credit: amount, projectId: dto.projectId },
        ];
      } else {
        lines = [
          { ledgerAccountId: accountLedger.id, debit: amount, credit: new Decimal(0), projectId: dto.projectId },
          { ledgerAccountId: incomeLedger.id, debit: new Decimal(0), credit: amount, categoryId: dto.categoryId, projectId: dto.projectId },
        ];
      }

      const journalEntry = await this.journalEntryService.createBalanced({
        entryDate: transactionDate,
        description: dto.description,
        sourceType: JournalEntrySourceType.SIMPLE_TRANSACTION,
        idempotencyKey,
        lines,
        tx,
      });

      return tx.transaction.create({
        data: {
          accountId: dto.accountId,
          categoryId: dto.categoryId,
          projectId: dto.projectId ?? null,
          journalEntryId: journalEntry.id,
          type: dto.type,
          status: TransactionStatus.POSTED,
          amount,
          description: dto.description,
          transactionDate,
        },
        include: this.transactionInclude,
      });
    });
  }

  async findAll(query: QueryTransactionDto): Promise<PaginatedResponse<TransactionWithRelations>> {
    const { page, limit, accountId, categoryId, projectId, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
      ...(projectId && { projectId }),
      ...(type && { type }),
      ...((startDate || endDate) && {
        transactionDate: {
          ...(startDate && { gte: startOfDay(parseDate(startDate)) }),
          ...(endDate && { lte: endOfDay(parseDate(endDate)) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({ where, skip, take: limit, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }], include: this.transactionInclude }),
      this.prisma.transaction.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<TransactionWithRelations> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id }, include: this.transactionInclude });
    if (!transaction) throw new TransactionNotFoundException(id);
    return transaction;
  }

  async update(id: string, dto: UpdateTransactionDto): Promise<TransactionWithRelations> {
    await this.findOne(id);
    if (dto.projectId) await this.validateProject(dto.projectId);

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
      },
      include: this.transactionInclude,
    });
  }

  async delete(id: string): Promise<void> {
    const transaction = await this.findOne(id);
    const journalEntryId = transaction.journalEntryId;

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });
      await tx.journalLine.deleteMany({ where: { journalEntryId } });
      await tx.journalEntry.delete({ where: { id: journalEntryId } });
    });
  }
}
