import { Injectable } from '@nestjs/common';
import { JournalEntrySourceType, JournalEntryStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UnbalancedJournalEntryError,
  InvalidJournalLineError,
} from '../../common/errors/domain.errors';

export interface JournalLineInput {
  ledgerAccountId: string;
  debit: Decimal | string;
  credit: Decimal | string;
  categoryId?: string;
  projectId?: string;
}

export interface CreateJournalEntryInput {
  entryDate: Date;
  description: string;
  sourceType: JournalEntrySourceType;
  sourceId?: string;
  idempotencyKey?: string;
  lines: JournalLineInput[];
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class JournalEntryService {
  constructor(private readonly prisma: PrismaService) {}

  private validate(lines: JournalLineInput[]): void {
    if (lines.length < 2) {
      throw new UnbalancedJournalEntryError();
    }

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of lines) {
      const debit = new Decimal(line.debit.toString());
      const credit = new Decimal(line.credit.toString());

      // A line cannot have both debit and credit > 0, nor both = 0
      if (debit.greaterThan(0) && credit.greaterThan(0)) {
        throw new InvalidJournalLineError();
      }
      if (!debit.greaterThan(0) && !credit.greaterThan(0)) {
        throw new InvalidJournalLineError();
      }

      totalDebits = totalDebits.add(debit);
      totalCredits = totalCredits.add(credit);
    }

    if (!totalDebits.equals(totalCredits)) {
      throw new UnbalancedJournalEntryError();
    }
  }

  async createBalanced(input: CreateJournalEntryInput) {
    this.validate(input.lines);

    const client = input.tx ?? this.prisma;

    const entry = await client.journalEntry.create({
      data: {
        entryDate: input.entryDate,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        status: JournalEntryStatus.POSTED,
        lines: {
          create: input.lines.map((line) => ({
            ledgerAccountId: line.ledgerAccountId,
            debit: new Decimal(line.debit.toString()),
            credit: new Decimal(line.credit.toString()),
            categoryId: line.categoryId ?? null,
            projectId: line.projectId ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    return entry;
  }

  async voidEntry(entryId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const entry = await client.journalEntry.findUnique({ where: { id: entryId } });
    if (!entry) return null;

    // Idempotent: already voided, return as-is
    if (entry.status === JournalEntryStatus.VOIDED) {
      return client.journalEntry.findUnique({ where: { id: entryId }, include: { lines: true } });
    }

    return client.journalEntry.update({
      where: { id: entryId },
      data: { status: JournalEntryStatus.VOIDED },
      include: { lines: true },
    });
  }
}
