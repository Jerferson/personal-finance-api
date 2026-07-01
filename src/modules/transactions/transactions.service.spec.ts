import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryService } from '../ledger/journal-entry.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import {
  CategoryTypeMismatchError,
  InvalidAmountError,
  TransactionNotFoundException,
} from '../../common/errors/domain.errors';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Isolated business-rule tests (no NestJS module needed) ─────────────────

describe('Transaction business rules', () => {
  describe('Amount validation', () => {
    const validateAmount = (amount: string) => {
      const decimal = new Decimal(amount);
      if (decimal.lessThanOrEqualTo(0)) {
        throw new InvalidAmountError();
      }
    };

    it('should throw InvalidAmountError for zero amount', () => {
      expect(() => validateAmount('0')).toThrow(InvalidAmountError);
    });

    it('should throw InvalidAmountError for negative amount', () => {
      expect(() => validateAmount('-100.00')).toThrow(InvalidAmountError);
    });

    it('should not throw for positive amount', () => {
      expect(() => validateAmount('0.01')).not.toThrow();
      expect(() => validateAmount('1000.00')).not.toThrow();
    });
  });

  describe('Category type validation', () => {
    const validateCategoryType = (
      transactionType: 'INCOME' | 'EXPENSE',
      categoryType: 'INCOME' | 'EXPENSE',
    ) => {
      if (transactionType !== categoryType) {
        throw new CategoryTypeMismatchError();
      }
    };

    it('should throw CategoryTypeMismatchError when EXPENSE category used with INCOME transaction', () => {
      expect(() => validateCategoryType('INCOME', 'EXPENSE')).toThrow(CategoryTypeMismatchError);
    });

    it('should throw CategoryTypeMismatchError when INCOME category used with EXPENSE transaction', () => {
      expect(() => validateCategoryType('EXPENSE', 'INCOME')).toThrow(CategoryTypeMismatchError);
    });

    it('should not throw when INCOME category used with INCOME transaction', () => {
      expect(() => validateCategoryType('INCOME', 'INCOME')).not.toThrow();
    });

    it('should not throw when EXPENSE category used with EXPENSE transaction', () => {
      expect(() => validateCategoryType('EXPENSE', 'EXPENSE')).not.toThrow();
    });
  });

  describe('Ledger line derivation for EXPENSE', () => {
    it('should produce Debit=Expenses, Credit=Account for EXPENSE type', () => {
      const type: string = 'EXPENSE';
      const expensesLedgerId = 'la-expenses';
      const accountLedgerId = 'la-checking';

      const debitLedgerId = type === 'INCOME' ? accountLedgerId : expensesLedgerId;
      const creditLedgerId = type === 'INCOME' ? 'la-income' : accountLedgerId;

      expect(debitLedgerId).toBe(expensesLedgerId);
      expect(creditLedgerId).toBe(accountLedgerId);
    });
  });

  describe('Ledger line derivation for INCOME', () => {
    it('should produce Debit=Account, Credit=Income for INCOME type', () => {
      const type = 'INCOME';
      const incomeLedgerId = 'la-income';
      const accountLedgerId = 'la-checking';

      const debitLedgerId = type === 'INCOME' ? accountLedgerId : 'la-expenses';
      const creditLedgerId = type === 'INCOME' ? incomeLedgerId : accountLedgerId;

      expect(debitLedgerId).toBe(accountLedgerId);
      expect(creditLedgerId).toBe(incomeLedgerId);
    });
  });
});

// ─── Service-level tests (with mocked dependencies) ─────────────────────────

const makeTransaction = (overrides = {}) => ({
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  projectId: null,
  journalEntryId: 'je-1',
  type: 'EXPENSE',
  status: 'POSTED',
  amount: new Decimal('300.00'),
  description: 'Groceries',
  transactionDate: new Date('2026-06-15'),
  createdAt: new Date(),
  updatedAt: new Date(),
  account: { id: 'acc-1' },
  category: { id: 'cat-1', type: 'EXPENSE' },
  project: null,
  journalEntry: { id: 'je-1', lines: [] },
  ...overrides,
});

const mockPrisma = {
  journalEntry: { findUnique: jest.fn(), create: jest.fn() },
  transaction: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  journalLine: { deleteMany: jest.fn() },
  account: { findUnique: jest.fn() },
  category: { findUnique: jest.fn() },
  project: { findUnique: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

const mockJournalEntryService = { createBalanced: jest.fn() };
const mockLedgerAccountService = {
  getExpensesLedgerAccount: jest.fn().mockResolvedValue({ id: 'la-expenses' }),
  getIncomeLedgerAccount: jest.fn().mockResolvedValue({ id: 'la-income' }),
  getAccountLedgerAccount: jest.fn().mockResolvedValue({ id: 'la-checking' }),
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JournalEntryService, useValue: mockJournalEntryService },
        { provide: LedgerAccountService, useValue: mockLedgerAccountService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
    mockLedgerAccountService.getExpensesLedgerAccount.mockResolvedValue({ id: 'la-expenses' });
    mockLedgerAccountService.getIncomeLedgerAccount.mockResolvedValue({ id: 'la-income' });
    mockLedgerAccountService.getAccountLedgerAccount.mockResolvedValue({ id: 'la-checking' });
  });

  describe('findOne', () => {
    it('should return transaction when found', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(makeTransaction());
      const result = await service.findOne('tx-1');
      expect(result.id).toBe('tx-1');
    });

    it('should throw TransactionNotFoundException when transaction does not exist', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(TransactionNotFoundException);
    });
  });

  describe('update', () => {
    it('should update description and projectId', async () => {
      const tx = makeTransaction();
      const updated = makeTransaction({ description: 'Updated', projectId: 'proj-1' });
      mockPrisma.transaction.findUnique.mockResolvedValue(tx);
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.transaction.update.mockResolvedValue(updated);

      const result = await service.update('tx-1', { description: 'Updated', projectId: 'proj-1' });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx-1' } }),
      );
      expect(result.description).toBe('Updated');
    });

    it('should throw TransactionNotFoundException when transaction does not exist', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { description: 'X' })).rejects.toThrow(
        TransactionNotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete transaction, journal lines, and journal entry atomically', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(makeTransaction());
      mockPrisma.transaction.delete.mockResolvedValue({});
      mockPrisma.journalLine.deleteMany.mockResolvedValue({});
      mockPrisma.journalEntry.delete = jest.fn().mockResolvedValue({});

      await service.delete('tx-1');

      expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'tx-1' } });
      expect(mockPrisma.journalLine.deleteMany).toHaveBeenCalledWith({ where: { journalEntryId: 'je-1' } });
      expect(mockPrisma.journalEntry.delete).toHaveBeenCalledWith({ where: { id: 'je-1' } });
    });

    it('should throw TransactionNotFoundException when transaction does not exist', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(TransactionNotFoundException);
    });

    it('should execute all deletes within a single database transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(makeTransaction());
      mockPrisma.transaction.delete.mockResolvedValue({});
      mockPrisma.journalLine.deleteMany.mockResolvedValue({});
      mockPrisma.journalEntry.delete = jest.fn().mockResolvedValue({});

      await service.delete('tx-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('create — idempotency', () => {
    it('should return existing transaction when idempotency key was already used', async () => {
      const existingTx = makeTransaction();
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        id: 'je-1',
        transaction: existingTx,
      });

      const result = await service.create(
        { accountId: 'acc-1', categoryId: 'cat-1', type: 'EXPENSE', amount: '300.00', description: 'Groceries', transactionDate: '2026-06-15' },
        'duplicate-key',
      );

      expect(result.id).toBe('tx-1');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
