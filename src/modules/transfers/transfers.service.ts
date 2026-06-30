import { Injectable } from '@nestjs/common';
import { JournalEntrySourceType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryService } from '../ledger/journal-entry.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import {
  AccountNotFoundException,
  InvalidAmountError,
  TransferSameAccountError,
} from '../../common/errors/domain.errors';
import { formatDateIso, parseDate } from '../../common/utils/dates';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

export interface TransferResponse {
  journalEntryId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: Decimal;
  transferDate: Date;
  description: string;
  createdAt: Date;
}

export interface TransferListItem {
  id: string;
  date: string;
  description: string;
  amount: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  createdAt: string;
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntryService: JournalEntryService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private readonly listInclude = {
    lines: { include: { ledgerAccount: { include: { accounts: true } } } },
  };

  async findAll(page: number, limit: number): Promise<PaginatedResponse<TransferListItem>> {
    const skip = (page - 1) * limit;
    const where = { sourceType: JournalEntrySourceType.TRANSFER };

    const [raw, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        include: this.listInclude,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    const data = raw.map(je => {
      const debitLine  = je.lines.find(l => new Decimal(l.debit.toString()).greaterThan(0));
      const creditLine = je.lines.find(l => new Decimal(l.credit.toString()).greaterThan(0));
      const toAccount   = debitLine?.ledgerAccount.accounts[0];
      const fromAccount = creditLine?.ledgerAccount.accounts[0];
      return {
        id: je.id,
        date: formatDateIso(je.entryDate),
        description: je.description,
        amount: debitLine?.debit.toString() ?? '0',
        fromAccountId:   fromAccount?.id   ?? '',
        fromAccountName: fromAccount?.name ?? 'Unknown',
        toAccountId:   toAccount?.id   ?? '',
        toAccountName: toAccount?.name ?? 'Unknown',
        createdAt: je.createdAt.toISOString(),
      };
    });

    return paginate(data, total, page, limit);
  }

  private async validateAccount(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new AccountNotFoundException(accountId);
    }
  }

  async create(
    dto: CreateTransferDto,
    idempotencyKey: string,
    endpoint: string,
  ): Promise<TransferResponse> {
    const result = await this.idempotencyService.run<TransferResponse>(
      {
        key: idempotencyKey,
        endpoint,
        body: dto,
        resourceType: 'transfer',
      },
      async () => {
        if (dto.fromAccountId === dto.toAccountId) {
          throw new TransferSameAccountError();
        }

        const amount = new Decimal(dto.amount);
        if (!amount.greaterThan(0)) {
          throw new InvalidAmountError();
        }

        await this.validateAccount(dto.fromAccountId);
        await this.validateAccount(dto.toAccountId);

        const transferDate = parseDate(dto.transferDate);

        const [fromLedger, toLedger] = await Promise.all([
          this.ledgerAccountService.getAccountLedgerAccount(dto.fromAccountId),
          this.ledgerAccountService.getAccountLedgerAccount(dto.toAccountId),
        ]);

        const journalEntry = await this.journalEntryService.createBalanced({
          entryDate: transferDate,
          description: dto.description,
          sourceType: JournalEntrySourceType.TRANSFER,
          idempotencyKey,
          lines: [
            {
              ledgerAccountId: toLedger.id,
              debit: amount,
              credit: new Decimal(0),
            },
            {
              ledgerAccountId: fromLedger.id,
              debit: new Decimal(0),
              credit: amount,
            },
          ],
        });

        const response: TransferResponse = {
          journalEntryId: journalEntry.id,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount,
          transferDate,
          description: dto.description,
          createdAt: journalEntry.createdAt,
        };

        return { data: response, statusCode: 201, resourceId: journalEntry.id };
      },
    );

    return result.data;
  }
}
