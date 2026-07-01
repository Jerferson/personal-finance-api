import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerAccountService } from '../ledger/ledger-account.service';
import { LedgerBalanceService } from '../ledger/ledger-balance.service';
import {
  AccountNotFoundException,
  AccountHasLinkedRecordsError,
} from '../../common/errors/domain.errors';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrisma = {
  account: {
    findUnique: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

const mockLedgerAccountService = {
  createAssetLedgerAccount: jest.fn(),
};

const mockLedgerBalanceService = {
  calculate: jest.fn(),
};

const makeAccount = (overrides = {}) => ({
  id: 'acc-1',
  name: 'Main Checking',
  type: 'CHECKING',
  currency: 'USD',
  initialBalance: new Decimal('1000.00'),
  ledgerAccountId: 'la-1',
  ledgerAccount: { id: 'la-1', journalLines: [] },
  transactions: [],
  scheduledBills: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerAccountService, useValue: mockLedgerAccountService },
        { provide: LedgerBalanceService, useValue: mockLedgerBalanceService },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return the account when found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());

      const result = await service.findOne('acc-1');

      expect(result.id).toBe('acc-1');
      expect(result.name).toBe('Main Checking');
    });

    it('should throw AccountNotFoundException when account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(AccountNotFoundException);
    });
  });

  describe('remove', () => {
    it('should throw AccountNotFoundException when account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(AccountNotFoundException);
    });

    it('should throw AccountHasLinkedRecordsError when account has transactions', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ transactions: [{ id: 'tx-1' }] }),
      );

      await expect(service.remove('acc-1')).rejects.toThrow(AccountHasLinkedRecordsError);
    });

    it('should throw AccountHasLinkedRecordsError when account has scheduled bills', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ scheduledBills: [{ id: 'sb-1' }] }),
      );

      await expect(service.remove('acc-1')).rejects.toThrow(AccountHasLinkedRecordsError);
    });

    it('should throw AccountHasLinkedRecordsError when account has journal lines', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({
          ledgerAccount: { id: 'la-1', journalLines: [{ id: 'jl-1' }] },
        }),
      );

      await expect(service.remove('acc-1')).rejects.toThrow(AccountHasLinkedRecordsError);
    });

    it('should delete account when no linked records exist', async () => {
      const account = makeAccount();
      mockPrisma.account.findUnique.mockResolvedValue(account);
      mockPrisma.account.delete.mockResolvedValue(account);

      await service.remove('acc-1');

      expect(mockPrisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
    });
  });

  describe('getBalance', () => {
    it('should delegate to LedgerBalanceService with no date when not provided', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      mockLedgerBalanceService.calculate.mockResolvedValue({
        accountId: 'acc-1',
        balance: new Decimal('3200.00'),
      });

      const result = await service.getBalance('acc-1');

      expect(mockLedgerBalanceService.calculate).toHaveBeenCalledWith('acc-1', undefined);
      expect(result.balance.toFixed(2)).toBe('3200.00');
    });

    it('should pass parsed Date to LedgerBalanceService when date string is provided', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      mockLedgerBalanceService.calculate.mockResolvedValue({
        accountId: 'acc-1',
        balance: new Decimal('2000.00'),
      });

      await service.getBalance('acc-1', '2026-06-01');

      expect(mockLedgerBalanceService.calculate).toHaveBeenCalledWith(
        'acc-1',
        expect.any(Date),
      );
    });

    it('should throw AccountNotFoundException when account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.getBalance('nonexistent')).rejects.toThrow(AccountNotFoundException);
    });
  });
});
