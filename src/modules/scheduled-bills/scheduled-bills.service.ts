import { Injectable } from '@nestjs/common';
import {
  JournalEntrySourceType,
  Prisma,
  ScheduledBillStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryService } from '../ledger/journal-entry.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import {
  AccountNotFoundException,
  CategoryNotFoundException,
  CategoryTypeMismatchError,
  InvalidAmountError,
  ProjectNotFoundException,
  ScheduledBillAlreadyPostedError,
  ScheduledBillNotFoundException,
  ScheduledBillNotScheduledError,
} from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { endOfDay, parseDate, startOfDay } from '../../common/utils/dates';
import { CreateScheduledBillDto } from './dto/create-scheduled-bill.dto';
import { UpdateScheduledBillDto } from './dto/update-scheduled-bill.dto';
import { QueryScheduledBillDto } from './dto/query-scheduled-bill.dto';

type ScheduledBillWithRelations = Prisma.ScheduledBillGetPayload<{
  include: {
    account: true;
    category: true;
    project: true;
    transaction: true;
  };
}>;

@Injectable()
export class ScheduledBillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntryService: JournalEntryService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private readonly scheduledBillInclude = {
    account: true,
    category: true,
    project: true,
    transaction: true,
  } satisfies Prisma.ScheduledBillInclude;

  private async validateAmount(amount: string): Promise<Decimal> {
    const decimal = new Decimal(amount);
    if (!decimal.greaterThan(0)) {
      throw new InvalidAmountError();
    }
    return decimal;
  }

  private async validateAccount(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new AccountNotFoundException(accountId);
    }
  }

  private async validateCategory(categoryId: string, type: TransactionType): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new CategoryNotFoundException(categoryId);
    }
    if (category.type !== type) {
      throw new CategoryTypeMismatchError();
    }
  }

  private async validateProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new ProjectNotFoundException(projectId);
    }
  }

  async create(
    dto: CreateScheduledBillDto,
    idempotencyKey: string,
    endpoint: string,
  ): Promise<ScheduledBillWithRelations> {
    const result = await this.idempotencyService.run<ScheduledBillWithRelations>(
      {
        key: idempotencyKey,
        endpoint,
        body: dto,
        resourceType: 'scheduled-bill',
      },
      async () => {
        await this.validateAmount(dto.amount);
        await this.validateAccount(dto.accountId);
        await this.validateCategory(dto.categoryId, dto.type);
        if (dto.projectId) {
          await this.validateProject(dto.projectId);
        }

        const dueDate = parseDate(dto.dueDate);
        const amount = new Decimal(dto.amount);

        const bill = await this.prisma.scheduledBill.create({
          data: {
            accountId: dto.accountId,
            categoryId: dto.categoryId,
            type: dto.type,
            amount,
            description: dto.description,
            dueDate,
            status: ScheduledBillStatus.SCHEDULED,
            projectId: dto.projectId ?? null,
          },
          include: this.scheduledBillInclude,
        });

        return { data: bill, statusCode: 201, resourceId: bill.id };
      },
    );

    return result.data;
  }

  async findAll(query: QueryScheduledBillDto): Promise<PaginatedResponse<ScheduledBillWithRelations>> {
    const { page, limit, accountId, categoryId, projectId, type, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ScheduledBillWhereInput = {
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
      ...(projectId && { projectId }),
      ...(type && { type }),
      ...(status && { status }),
      ...((startDate || endDate) && {
        dueDate: {
          ...(startDate && { gte: startOfDay(parseDate(startDate)) }),
          ...(endDate && { lte: endOfDay(parseDate(endDate)) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.scheduledBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: this.scheduledBillInclude,
      }),
      this.prisma.scheduledBill.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<ScheduledBillWithRelations> {
    const bill = await this.prisma.scheduledBill.findUnique({
      where: { id },
      include: this.scheduledBillInclude,
    });

    if (!bill) {
      throw new ScheduledBillNotFoundException(id);
    }

    return bill;
  }

  async update(id: string, dto: UpdateScheduledBillDto): Promise<ScheduledBillWithRelations> {
    const bill = await this.findOne(id);

    if (bill.status !== ScheduledBillStatus.SCHEDULED) {
      throw new ScheduledBillNotScheduledError('update');
    }

    // Re-validate category type if type or categoryId is being changed
    const effectiveType = dto.type ?? bill.type;
    const effectiveCategoryId = dto.categoryId ?? bill.categoryId;

    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.validateCategory(effectiveCategoryId, effectiveType);
    }

    if (dto.accountId !== undefined) {
      await this.validateAccount(dto.accountId);
    }

    if (dto.projectId !== undefined) {
      await this.validateProject(dto.projectId);
    }

    if (dto.amount !== undefined) {
      await this.validateAmount(dto.amount);
    }

    return this.prisma.scheduledBill.update({
      where: { id },
      data: {
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dueDate !== undefined && { dueDate: parseDate(dto.dueDate) }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
      },
      include: this.scheduledBillInclude,
    });
  }

  async post(
    id: string,
    idempotencyKey: string,
    endpoint: string,
  ): Promise<ScheduledBillWithRelations> {
    const result = await this.idempotencyService.run<ScheduledBillWithRelations>(
      {
        key: idempotencyKey,
        endpoint,
        body: { id },
        resourceType: 'scheduled-bill',
      },
      async () => {
        const bill = await this.findOne(id);

        // Idempotent: already posted
        if (bill.status === ScheduledBillStatus.POSTED) {
          return { data: bill, statusCode: 200, resourceId: bill.id };
        }

        if (bill.status !== ScheduledBillStatus.SCHEDULED) {
          throw new ScheduledBillNotScheduledError('post');
        }

        const amount = new Decimal(bill.amount.toString());
        const dueDate = bill.dueDate;

        const updatedBill = await this.prisma.$transaction(async (tx) => {
          // Resolve ledger accounts
          const [expensesLedger, incomeLedger, accountLedger] = await Promise.all([
            this.ledgerAccountService.getExpensesLedgerAccount(),
            this.ledgerAccountService.getIncomeLedgerAccount(),
            this.ledgerAccountService.getAccountLedgerAccount(bill.accountId),
          ]);

          // Build journal lines
          let lines: Parameters<typeof this.journalEntryService.createBalanced>[0]['lines'];

          if (bill.type === TransactionType.EXPENSE) {
            lines = [
              {
                ledgerAccountId: expensesLedger.id,
                debit: amount,
                credit: new Decimal(0),
                categoryId: bill.categoryId,
                projectId: bill.projectId ?? undefined,
              },
              {
                ledgerAccountId: accountLedger.id,
                debit: new Decimal(0),
                credit: amount,
                projectId: bill.projectId ?? undefined,
              },
            ];
          } else {
            lines = [
              {
                ledgerAccountId: accountLedger.id,
                debit: amount,
                credit: new Decimal(0),
                projectId: bill.projectId ?? undefined,
              },
              {
                ledgerAccountId: incomeLedger.id,
                debit: new Decimal(0),
                credit: amount,
                categoryId: bill.categoryId,
                projectId: bill.projectId ?? undefined,
              },
            ];
          }

          const journalEntry = await this.journalEntryService.createBalanced({
            entryDate: dueDate,
            description: bill.description,
            sourceType: JournalEntrySourceType.SCHEDULED_BILL,
            sourceId: bill.id,
            idempotencyKey,
            lines,
            tx,
          });

          const transaction = await tx.transaction.create({
            data: {
              accountId: bill.accountId,
              categoryId: bill.categoryId,
              projectId: bill.projectId ?? null,
              journalEntryId: journalEntry.id,
              type: bill.type,
              status: TransactionStatus.POSTED,
              amount,
              description: bill.description,
              transactionDate: dueDate,
            },
          });

          return tx.scheduledBill.update({
            where: { id },
            data: {
              status: ScheduledBillStatus.POSTED,
              transactionId: transaction.id,
            },
            include: this.scheduledBillInclude,
          });
        });

        return { data: updatedBill, statusCode: 200, resourceId: updatedBill.id };
      },
    );

    return result.data;
  }

  async cancel(
    id: string,
    idempotencyKey: string,
    endpoint: string,
  ): Promise<ScheduledBillWithRelations> {
    const result = await this.idempotencyService.run<ScheduledBillWithRelations>(
      {
        key: idempotencyKey,
        endpoint,
        body: { id },
        resourceType: 'scheduled-bill',
      },
      async () => {
        const bill = await this.findOne(id);

        // Idempotent: already cancelled
        if (bill.status === ScheduledBillStatus.CANCELLED) {
          return { data: bill, statusCode: 200, resourceId: bill.id };
        }

        if (bill.status === ScheduledBillStatus.POSTED) {
          throw new ScheduledBillAlreadyPostedError();
        }

        const updated = await this.prisma.scheduledBill.update({
          where: { id },
          data: { status: ScheduledBillStatus.CANCELLED },
          include: this.scheduledBillInclude,
        });

        return { data: updated, statusCode: 200, resourceId: updated.id };
      },
    );

    return result.data;
  }
}
