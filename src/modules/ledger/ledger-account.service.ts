import { Injectable } from '@nestjs/common';
import { LedgerAccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Generic ledger account codes (created by seed)
export const INCOME_LEDGER_CODE = '4000';
export const EXPENSES_LEDGER_CODE = '5000';

@Injectable()
export class LedgerAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssetLedgerAccount(
    name: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string; code: string; name: string }> {
    const client = tx ?? this.prisma;

    // Find the highest existing asset code in range 1000-1999
    const highest = await client.ledgerAccount.findFirst({
      where: {
        type: LedgerAccountType.ASSET,
        code: { gte: '1000', lte: '1999' },
      },
      orderBy: { code: 'desc' },
    });

    const nextCode = highest ? String(Number(highest.code) + 1) : '1000';

    return client.ledgerAccount.create({
      data: {
        code: nextCode,
        name: `Assets:${name}`,
        type: LedgerAccountType.ASSET,
      },
    });
  }

  async getIncomeLedgerAccount(): Promise<{ id: string }> {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { code: INCOME_LEDGER_CODE },
    });
    if (!account) {
      throw new Error('Generic Income ledger account not found. Run the seed first.');
    }
    return account;
  }

  async getExpensesLedgerAccount(): Promise<{ id: string }> {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { code: EXPENSES_LEDGER_CODE },
    });
    if (!account) {
      throw new Error('Generic Expenses ledger account not found. Run the seed first.');
    }
    return account;
  }

  async getAccountLedgerAccount(accountId: string): Promise<{ id: string }> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { ledgerAccount: true },
    });
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }
    return account.ledgerAccount;
  }
}
