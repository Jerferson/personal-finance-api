import { Test, TestingModule } from '@nestjs/testing';
import { JournalEntryService } from './journal-entry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UnbalancedJournalEntryError, InvalidJournalLineError } from '../../common/errors/domain.errors';
import { Decimal } from '@prisma/client/runtime/library';
import { JournalEntrySourceType } from '@prisma/client';

const mockPrisma: Record<string, unknown> & {
  journalEntry: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
} = {
  journalEntry: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

describe('JournalEntryService', () => {
  let service: JournalEntryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEntryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<JournalEntryService>(JournalEntryService);
    jest.clearAllMocks();
  });

  const validLines = [
    { ledgerAccountId: 'la-expenses', debit: new Decimal('100.00'), credit: new Decimal('0') },
    { ledgerAccountId: 'la-checking', debit: new Decimal('0'), credit: new Decimal('100.00') },
  ];

  describe('createBalanced', () => {
    it('should create a journal entry when debits equal credits', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({ id: 'je-1', lines: [] });

      await service.createBalanced({
        entryDate: new Date(),
        description: 'Grocery shopping',
        sourceType: JournalEntrySourceType.SIMPLE_TRANSACTION,
        lines: validLines,
      });

      expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
    });

    it('should throw UnbalancedJournalEntryError when debits do not equal credits', async () => {
      const unbalancedLines = [
        { ledgerAccountId: 'la-expenses', debit: new Decimal('100.00'), credit: new Decimal('0') },
        { ledgerAccountId: 'la-checking', debit: new Decimal('0'), credit: new Decimal('90.00') },
      ];

      await expect(
        service.createBalanced({
          entryDate: new Date(),
          description: 'Unbalanced entry',
          sourceType: JournalEntrySourceType.MANUAL,
          lines: unbalancedLines,
        }),
      ).rejects.toThrow(UnbalancedJournalEntryError);
    });

    it('should throw UnbalancedJournalEntryError when fewer than 2 lines provided', async () => {
      const singleLine = [
        { ledgerAccountId: 'la-expenses', debit: new Decimal('100.00'), credit: new Decimal('0') },
      ];

      await expect(
        service.createBalanced({
          entryDate: new Date(),
          description: 'Single line',
          sourceType: JournalEntrySourceType.MANUAL,
          lines: singleLine,
        }),
      ).rejects.toThrow(UnbalancedJournalEntryError);
    });

    it('should throw InvalidJournalLineError when a line has both debit and credit > 0', async () => {
      const invalidLines = [
        { ledgerAccountId: 'la-a', debit: new Decimal('100.00'), credit: new Decimal('100.00') },
        { ledgerAccountId: 'la-b', debit: new Decimal('0'), credit: new Decimal('0') },
      ];

      await expect(
        service.createBalanced({
          entryDate: new Date(),
          description: 'Invalid line',
          sourceType: JournalEntrySourceType.MANUAL,
          lines: invalidLines,
        }),
      ).rejects.toThrow(InvalidJournalLineError);
    });

    it('should throw InvalidJournalLineError when a line has both debit and credit = 0', async () => {
      const invalidLines = [
        { ledgerAccountId: 'la-a', debit: new Decimal('0'), credit: new Decimal('0') },
        { ledgerAccountId: 'la-b', debit: new Decimal('100.00'), credit: new Decimal('0') },
      ];

      await expect(
        service.createBalanced({
          entryDate: new Date(),
          description: 'Zero line',
          sourceType: JournalEntrySourceType.MANUAL,
          lines: invalidLines,
        }),
      ).rejects.toThrow(InvalidJournalLineError);
    });

    it('should support multi-line entries that balance correctly', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({ id: 'je-2', lines: [] });

      const multiLines = [
        { ledgerAccountId: 'la-expenses-food', debit: new Decimal('60.00'), credit: new Decimal('0') },
        { ledgerAccountId: 'la-expenses-transport', debit: new Decimal('40.00'), credit: new Decimal('0') },
        { ledgerAccountId: 'la-checking', debit: new Decimal('0'), credit: new Decimal('100.00') },
      ];

      await expect(
        service.createBalanced({
          entryDate: new Date(),
          description: 'Multi-line entry',
          sourceType: JournalEntrySourceType.MANUAL,
          lines: multiLines,
        }),
      ).resolves.not.toThrow();
    });
  });

});
