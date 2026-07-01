import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledBillsService } from './scheduled-bills.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryService } from '../ledger/journal-entry.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import {
  ScheduledBillNotFoundException,
  ScheduledBillNotScheduledError,
} from '../../common/errors/domain.errors';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = {
  scheduledBill: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  transaction: { create: jest.fn() },
  account: { findUnique: jest.fn() },
  category: { findUnique: jest.fn() },
  project: { findUnique: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

const mockJournalEntryService = {
  createBalanced: jest.fn(),
};

const mockLedgerAccountService = {
  getExpensesLedgerAccount: jest.fn(),
  getIncomeLedgerAccount: jest.fn(),
  getAccountLedgerAccount: jest.fn(),
};

const makeScheduledBill = (overrides = {}) => ({
  id: 'sb-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  type: 'EXPENSE',
  amount: new Decimal('1500.00'),
  description: 'Monthly rent',
  dueDate: new Date('2026-07-02'),
  status: 'SCHEDULED',
  projectId: null,
  idempotencyKey: 'key-123',
  account: { id: 'acc-1' },
  category: { id: 'cat-1', type: 'EXPENSE' },
  project: null,
  transaction: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ScheduledBillsService', () => {
  let service: ScheduledBillsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledBillsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JournalEntryService, useValue: mockJournalEntryService },
        { provide: LedgerAccountService, useValue: mockLedgerAccountService },
      ],
    }).compile();

    service = module.get<ScheduledBillsService>(ScheduledBillsService);
    jest.clearAllMocks();
    mockLedgerAccountService.getExpensesLedgerAccount.mockResolvedValue({ id: 'la-expenses' });
    mockLedgerAccountService.getIncomeLedgerAccount.mockResolvedValue({ id: 'la-income' });
    mockLedgerAccountService.getAccountLedgerAccount.mockResolvedValue({ id: 'la-checking' });
    mockJournalEntryService.createBalanced.mockResolvedValue({ id: 'je-1', lines: [] });
    mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-new' });
  });

  describe('findOne', () => {
    it('should throw ScheduledBillNotFoundException when bill does not exist', async () => {
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(ScheduledBillNotFoundException);
    });

    it('should return the scheduled bill when found', async () => {
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(makeScheduledBill());

      const result = await service.findOne('sb-1');

      expect(result.id).toBe('sb-1');
    });
  });

  describe('post', () => {
    it('should return bill unchanged when already POSTED (status-based idempotency)', async () => {
      const postedBill = makeScheduledBill({ status: 'POSTED' });
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(postedBill);

      const result = await service.post('sb-1');

      expect(result.status).toBe('POSTED');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should post bill atomically and update status to POSTED', async () => {
      const bill = makeScheduledBill({ status: 'SCHEDULED' });
      const postedBill = makeScheduledBill({ status: 'POSTED', transaction: { id: 'tx-new' } });
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(bill);
      mockPrisma.scheduledBill.update.mockResolvedValue(postedBill);

      const result = await service.post('sb-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('POSTED');
    });

    it('should throw ScheduledBillNotFoundException when bill does not exist', async () => {
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(null);

      await expect(service.post('nonexistent')).rejects.toThrow(ScheduledBillNotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ScheduledBillNotScheduledError when updating a POSTED bill', async () => {
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(
        makeScheduledBill({ status: 'POSTED' }),
      );

      await expect(service.update('sb-1', { description: 'Updated' })).rejects.toThrow(
        ScheduledBillNotScheduledError,
      );
    });

    it('should throw ScheduledBillNotFoundException when bill does not exist', async () => {
      mockPrisma.scheduledBill.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { description: 'X' })).rejects.toThrow(
        ScheduledBillNotFoundException,
      );
    });
  });
});
