import { Test, TestingModule } from '@nestjs/testing';
import { ProjectionsService } from './projections.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerBalanceService } from '../ledger/ledger-balance.service';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = {
  account: { findMany: jest.fn(), findUnique: jest.fn() },
  scheduledBill: { findMany: jest.fn() },
};

const mockLedgerBalance = {
  calculate: jest.fn(),
};

const makeBalance = (balance: string, overrides = {}) => ({
  accountId: 'acc-1',
  accountName: 'Checking',
  date: '2026-06-27',
  initialBalance: new Decimal('1000.00'),
  totalDebits: new Decimal('0'),
  totalCredits: new Decimal('0'),
  balance: new Decimal(balance),
  ...overrides,
});

describe('ProjectionsService', () => {
  let service: ProjectionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerBalanceService, useValue: mockLedgerBalance },
      ],
    }).compile();

    service = module.get<ProjectionsService>(ProjectionsService);
    jest.clearAllMocks();
  });

  // ─── getBudgetProjection ──────────────────────────────────────────────────

  describe('getBudgetProjection', () => {
    it('should calculate projectedBalance including scheduled income', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1', name: 'Checking' }]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('3500.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([
        { accountId: 'acc-1', type: 'INCOME', amount: new Decimal('6000.00') },
        { accountId: 'acc-1', type: 'INCOME', amount: new Decimal('6000.00') },
      ]);

      const result = await service.getBudgetProjection({ until: '2026-12-31' });

      expect(result.projectedBalance.toFixed(2)).toBe('15500.00');
      expect(result.scheduledIncome.toFixed(2)).toBe('12000.00');
      expect(result.scheduledExpenses.toFixed(2)).toBe('0.00');
    });

    it('should calculate projectedBalance deducting scheduled expenses', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1', name: 'Checking' }]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('3500.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([
        { accountId: 'acc-1', type: 'EXPENSE', amount: new Decimal('1500.00') },
        { accountId: 'acc-1', type: 'EXPENSE', amount: new Decimal('500.00') },
      ]);

      const result = await service.getBudgetProjection({ until: '2026-12-31' });

      expect(result.projectedBalance.toFixed(2)).toBe('1500.00');
      expect(result.scheduledExpenses.toFixed(2)).toBe('2000.00');
    });

    it('should ignore CANCELLED scheduled bills (excluded by query status filter)', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1', name: 'Checking' }]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('1000.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getBudgetProjection({ until: '2026-12-31' });

      expect(result.projectedBalance.toFixed(2)).toBe('1000.00');
      expect(result.scheduledIncome.toFixed(2)).toBe('0.00');
      expect(result.scheduledExpenses.toFixed(2)).toBe('0.00');
    });

    it('should filter scheduled bills by dueDate <= until', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1', name: 'Checking' }]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('3500.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([
        { accountId: 'acc-1', type: 'INCOME', amount: new Decimal('6000.00') },
      ]);

      await service.getBudgetProjection({ until: '2026-07-31' });

      expect(mockPrisma.scheduledBill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SCHEDULED',
            dueDate: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should return per-account breakdown in accounts array', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', name: 'Checking' },
        { id: 'acc-2', name: 'Savings' },
      ]);
      mockLedgerBalance.calculate
        .mockResolvedValueOnce(makeBalance('3500.00'))
        .mockResolvedValueOnce(makeBalance('5000.00', { accountId: 'acc-2', accountName: 'Savings' }));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([
        { accountId: 'acc-1', type: 'INCOME', amount: new Decimal('6000.00') },
        { accountId: 'acc-2', type: 'EXPENSE', amount: new Decimal('1000.00') },
      ]);

      const result = await service.getBudgetProjection({ until: '2026-12-31' });

      expect(result.accounts).toHaveLength(2);
      expect(result.accounts[0].accountId).toBe('acc-1');
      expect(result.accounts[1].accountId).toBe('acc-2');
      // acc-1: 3500 + 6000 = 9500, acc-2: 5000 - 1000 = 4000, total = 13500
      expect(result.projectedBalance.toFixed(2)).toBe('13500.00');
    });

    it('should return zero projectedBalance when no accounts exist', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getBudgetProjection({ until: '2026-12-31' });

      expect(result.projectedBalance.toFixed(2)).toBe('0.00');
      expect(result.accounts).toHaveLength(0);
    });
  });

  // ─── getCashflowProjection ────────────────────────────────────────────────

  describe('getCashflowProjection', () => {
    it('should return the requested number of months', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1', name: 'Checking' }]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('1000.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getCashflowProjection({ months: 3 });

      expect(result.months).toHaveLength(3);
    });

    it('should cap projection at 24 months regardless of input', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('0.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getCashflowProjection({ months: 100 });

      expect(result.months).toHaveLength(24);
    });

    it('should chain balance month by month (startingBalance of month N+1 = projectedEndBalance of month N)', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: 'acc-1', name: 'Checking' }]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('1000.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getCashflowProjection({ months: 3 });

      expect(result.months[1].startingBalance).toBe(result.months[0].projectedEndBalance);
      expect(result.months[2].startingBalance).toBe(result.months[1].projectedEndBalance);
    });

    it('should include currentBalance as sum of all account balances', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', name: 'Checking' },
        { id: 'acc-2', name: 'Savings' },
      ]);
      mockLedgerBalance.calculate
        .mockResolvedValueOnce(makeBalance('2000.00'))
        .mockResolvedValueOnce(makeBalance('3000.00', { accountId: 'acc-2' }));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getCashflowProjection({ months: 1 });

      expect(result.currentBalance).toBe('5000.00');
    });

    it('should use default of 13 months when months param is not provided', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockLedgerBalance.calculate.mockResolvedValue(makeBalance('0.00'));
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getCashflowProjection({});

      expect(result.months).toHaveLength(13);
    });

    it('should reflect zero balance with no accounts', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);
      mockPrisma.scheduledBill.findMany.mockResolvedValue([]);

      const result = await service.getCashflowProjection({ months: 2 });

      expect(result.currentBalance).toBe('0.00');
      expect(result.months[0].startingBalance).toBe('0.00');
      expect(result.months[0].projectedEndBalance).toBe('0.00');
    });
  });
});
