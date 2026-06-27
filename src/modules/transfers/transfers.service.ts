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
import { parseDate } from '../../common/utils/dates';
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

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntryService: JournalEntryService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

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
