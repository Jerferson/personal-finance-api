import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerAccountNotFoundException } from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { QueryLedgerAccountDto } from './dto/query-ledger-account.dto';

type LedgerAccount = Prisma.LedgerAccountGetPayload<Record<string, never>>;

@Injectable()
export class LedgerAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryLedgerAccountDto,
  ): Promise<PaginatedResponse<LedgerAccount>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ledgerAccount.findMany({
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.ledgerAccount.count(),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<LedgerAccount> {
    const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
      where: { id },
    });

    if (!ledgerAccount) {
      throw new LedgerAccountNotFoundException(id);
    }

    return ledgerAccount;
  }
}
