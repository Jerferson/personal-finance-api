import { BadRequestException, Injectable } from '@nestjs/common';
import { JournalEntryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryService } from '../ledger/journal-entry.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { JournalEntryNotFoundException } from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { endOfDay, parseDate, startOfDay } from '../../common/utils/dates';
import { QueryJournalEntryDto } from './dto/query-journal-entry.dto';

type JournalEntryWithLines = Prisma.JournalEntryGetPayload<{
  include: {
    lines: { include: { ledgerAccount: true } };
  };
}>;

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntryService: JournalEntryService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private readonly journalEntryInclude = {
    lines: { include: { ledgerAccount: true } },
  } satisfies Prisma.JournalEntryInclude;

  async findAll(query: QueryJournalEntryDto): Promise<PaginatedResponse<JournalEntryWithLines>> {
    const { page, limit, status, sourceType, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {
      ...(status && { status }),
      ...(sourceType && { sourceType }),
      ...((startDate || endDate) && {
        entryDate: {
          ...(startDate && { gte: startOfDay(parseDate(startDate)) }),
          ...(endDate && { lte: endOfDay(parseDate(endDate)) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        include: this.journalEntryInclude,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<JournalEntryWithLines> {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: this.journalEntryInclude,
    });

    if (!entry) {
      throw new JournalEntryNotFoundException(id);
    }

    return entry;
  }

  async void(
    id: string,
    idempotencyKey: string,
    endpoint: string,
  ): Promise<JournalEntryWithLines> {
    const result = await this.idempotencyService.run<JournalEntryWithLines>(
      {
        key: idempotencyKey,
        endpoint,
        body: { id },
        resourceType: 'journal-entry',
      },
      async () => {
        const entry = await this.findOne(id);

        // Check if the entry has a linked transaction
        const linkedTransaction = await this.prisma.transaction.findUnique({
          where: { journalEntryId: id },
        });

        if (linkedTransaction) {
          throw new BadRequestException(
            'Use POST /transactions/:id/void to void this entry',
          );
        }

        // Idempotent: already voided
        if (entry.status === JournalEntryStatus.VOIDED) {
          return { data: entry, statusCode: 200, resourceId: entry.id };
        }

        const voided = await this.journalEntryService.voidEntry(id);

        const updated = await this.findOne(id);

        return { data: updated, statusCode: 200, resourceId: entry.id };
      },
    );

    return result.data;
  }
}
