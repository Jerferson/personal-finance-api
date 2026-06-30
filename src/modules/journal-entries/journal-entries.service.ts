import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

}
