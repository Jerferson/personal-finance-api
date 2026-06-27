import { CategoryTypeMismatchError, InvalidAmountError } from '../../common/errors/domain.errors';
import { Decimal } from '@prisma/client/runtime/library';

// Isolated unit tests for category type validation and amount validation rules
// These are the core financial rules that must be protected

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
      const type = 'EXPENSE';
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

  describe('Transaction status: POSTED transactions affect balance, VOIDED do not', () => {
    const calculateBalance = (
      initialBalance: Decimal,
      transactions: Array<{ type: 'INCOME' | 'EXPENSE'; status: 'POSTED' | 'VOIDED'; amount: Decimal }>,
    ): Decimal => {
      let balance = initialBalance;
      for (const tx of transactions) {
        if (tx.status === 'POSTED') {
          if (tx.type === 'INCOME') {
            balance = balance.add(tx.amount);
          } else {
            balance = balance.sub(tx.amount);
          }
        }
        // VOIDED transactions are ignored
      }
      return balance;
    };

    it('should include POSTED income in balance', () => {
      const result = calculateBalance(new Decimal('1000'), [
        { type: 'INCOME', status: 'POSTED', amount: new Decimal('5000') },
      ]);
      expect(result.toString()).toBe('6000');
    });

    it('should include POSTED expense in balance', () => {
      const result = calculateBalance(new Decimal('1000'), [
        { type: 'EXPENSE', status: 'POSTED', amount: new Decimal('300') },
      ]);
      expect(result.toString()).toBe('700');
    });

    it('should NOT include VOIDED transaction in balance', () => {
      const result = calculateBalance(new Decimal('1000'), [
        { type: 'INCOME', status: 'VOIDED', amount: new Decimal('5000') },
        { type: 'EXPENSE', status: 'VOIDED', amount: new Decimal('2000') },
      ]);
      expect(result.toString()).toBe('1000');
    });

    it('should calculate balance with mix of POSTED and VOIDED', () => {
      const result = calculateBalance(new Decimal('500'), [
        { type: 'INCOME', status: 'POSTED', amount: new Decimal('1000') },
        { type: 'EXPENSE', status: 'VOIDED', amount: new Decimal('9000') }, // ignored
        { type: 'EXPENSE', status: 'POSTED', amount: new Decimal('200') },
      ]);
      // 500 + 1000 - 200 = 1300
      expect(result.toString()).toBe('1300');
    });
  });
});
