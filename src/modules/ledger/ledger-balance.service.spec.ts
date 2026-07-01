import { Test, TestingModule } from '@nestjs/testing';
import { LedgerBalanceService } from './ledger-balance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = {
  account: {
    findUnique: jest.fn(),
  },
  journalLine: {
    aggregate: jest.fn(),
  },
};

const makeAccount = (overrides = {}) => ({
  id: 'acc-1',
  name: 'Main Checking',
  ledgerAccountId: 'la-1',
  initialBalance: new Decimal('1000.00'),
  ledgerAccount: { id: 'la-1' },
  ...overrides,
});

const makeAggregate = (debit: string, credit: string) => ({
  _sum: {
    debit: new Decimal(debit),
    credit: new Decimal(credit),
  },
});

describe('LedgerBalanceService', () => {
  let service: LedgerBalanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerBalanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerBalanceService>(LedgerBalanceService);
    jest.clearAllMocks();
  });

  describe('calculate', () => {
    it('should return initialBalance when there are no transactions', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('0', '0'));

      const result = await service.calculate('acc-1');

      expect(result.balance.toFixed(2)).toBe('1000.00');
      expect(result.totalDebits.toFixed(2)).toBe('0.00');
      expect(result.totalCredits.toFixed(2)).toBe('0.00');
    });

    it('should increase balance with posted income (debit on asset account)', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      // Income entry: Debit AccountLedger → totalDebits increases
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('5000.00', '0'));

      const result = await service.calculate('acc-1');

      // balance = 1000 + 5000 - 0 = 6000
      expect(result.balance.toFixed(2)).toBe('6000.00');
      expect(result.totalDebits.toFixed(2)).toBe('5000.00');
    });

    it('should decrease balance with posted expense (credit on asset account)', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      // Expense entry: Credit AccountLedger → totalCredits increases
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('0', '2300.00'));

      const result = await service.calculate('acc-1');

      // balance = 1000 + 0 - 2300 = -1300
      expect(result.balance.toFixed(2)).toBe('-1300.00');
      expect(result.totalCredits.toFixed(2)).toBe('2300.00');
    });

    it('should correctly calculate balance with both income and expenses', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      // Income debits: 5000, Expense credits: 2300, transfer out: 500
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('5000.00', '2800.00'));

      const result = await service.calculate('acc-1');

      // balance = 1000 + 5000 - 2800 = 3200
      expect(result.balance.toFixed(2)).toBe('3200.00');
    });

    it('should include transfer effect on balance', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      // Income: 5000 debit, Expenses: 2300 credit, Transfer out: 500 credit
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('5000.00', '2800.00'));

      const result = await service.calculate('acc-1');
      // Transfers out appear as credits, reducing balance
      expect(result.balance.equals(new Decimal('3200.00'))).toBe(true);
    });

    it('should filter by date when date is provided', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('3000.00', '1000.00'));

      const specificDate = new Date('2026-06-15T00:00:00.000Z');
      await service.calculate('acc-1', specificDate);

      // Verify aggregate was called with the date filter
      expect(mockPrisma.journalLine.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journalEntry: expect.objectContaining({
              entryDate: { lte: specificDate },
            }),
          }),
        }),
      );
    });

    it('should only aggregate journal lines from POSTED journal entries', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('0', '0'));

      await service.calculate('acc-1');

      // Verify the query filters for POSTED journal entries
      expect(mockPrisma.journalLine.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journalEntry: expect.objectContaining({
              status: 'POSTED',
            }),
          }),
        }),
      );
    });

    it('should return account metadata correctly', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount({ name: 'Savings Account' }));
      mockPrisma.journalLine.aggregate.mockResolvedValue(makeAggregate('0', '0'));

      const result = await service.calculate('acc-1');

      expect(result.accountId).toBe('acc-1');
      expect(result.accountName).toBe('Savings Account');
      expect(result.initialBalance.toFixed(2)).toBe('1000.00');
    });
  });
});
