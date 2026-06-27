import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import { LedgerBalanceService } from '../ledger/ledger-balance.service';
import {
  AccountHasLinkedRecordsError,
  AccountNotFoundException,
} from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { parseDate } from '../../common/utils/dates';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account, Prisma } from '@prisma/client';

type AccountWithLedger = Prisma.AccountGetPayload<{
  include: { ledgerAccount: true };
}>;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly ledgerBalanceService: LedgerBalanceService,
  ) {}

  async create(dto: CreateAccountDto): Promise<AccountWithLedger> {
    return this.prisma.$transaction(async (tx) => {
      const ledgerAccount = await this.ledgerAccountService.createAssetLedgerAccount(
        dto.name,
        tx,
      );

      return tx.account.create({
        data: {
          name: dto.name,
          type: dto.type,
          currency: dto.currency ?? 'USD',
          initialBalance: dto.initialBalance ?? 0,
          ledgerAccountId: ledgerAccount.id,
        },
        include: { ledgerAccount: true },
      });
    });
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<AccountWithLedger>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { ledgerAccount: true },
      }),
      this.prisma.account.count(),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<AccountWithLedger> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { ledgerAccount: true },
    });

    if (!account) {
      throw new AccountNotFoundException(id);
    }

    return account;
  }

  async update(id: string, dto: UpdateAccountDto): Promise<AccountWithLedger> {
    await this.findOne(id);

    return this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.initialBalance !== undefined && { initialBalance: dto.initialBalance }),
      },
      include: { ledgerAccount: true },
    });
  }

  async remove(id: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        transactions: { take: 1 },
        scheduledBills: { take: 1 },
        ledgerAccount: {
          include: {
            journalLines: { take: 1 },
          },
        },
      },
    });

    if (!account) {
      throw new AccountNotFoundException(id);
    }

    const hasTransactions = account.transactions.length > 0;
    const hasScheduledBills = account.scheduledBills.length > 0;
    const hasJournalLines = account.ledgerAccount.journalLines.length > 0;

    if (hasTransactions || hasScheduledBills || hasJournalLines) {
      throw new AccountHasLinkedRecordsError();
    }

    return this.prisma.account.delete({ where: { id } });
  }

  async getBalance(id: string, dateStr?: string) {
    await this.findOne(id);

    const date = dateStr ? parseDate(dateStr) : undefined;
    return this.ledgerBalanceService.calculate(id, date);
  }
}
