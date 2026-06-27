import {
  PrismaClient,
  AccountType,
  CategoryType,
  LedgerAccountType,
  JournalEntrySourceType,
  JournalEntryStatus,
  TransactionType,
  TransactionStatus,
  ScheduledBillStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Fixed UUID v4-compliant IDs for idempotent upsert
// Format: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
const IDS = {
  // Ledger accounts
  ledgerIncome:           'a0000000-0000-4000-8000-000000000001',
  ledgerExpenses:         'a0000000-0000-4000-8000-000000000002',
  ledgerChecking:         'a0000000-0000-4000-8000-000000000003',
  ledgerSavings:          'a0000000-0000-4000-8000-000000000004',
  ledgerCash:             'a0000000-0000-4000-8000-000000000005',
  // Accounts
  accountChecking:        'b0000000-0000-4000-8000-000000000001',
  accountSavings:         'b0000000-0000-4000-8000-000000000002',
  accountCash:            'b0000000-0000-4000-8000-000000000003',
  // Categories — Income
  catSalary:              'c0000000-0000-4000-8000-000000000001',
  catFreelance:           'c0000000-0000-4000-8000-000000000002',
  catInvestmentReturn:    'c0000000-0000-4000-8000-000000000003',
  // Categories — Expense
  catFood:                'c0000000-0000-4000-8000-000000000004',
  catRent:                'c0000000-0000-4000-8000-000000000005',
  catTransport:           'c0000000-0000-4000-8000-000000000006',
  catHealth:              'c0000000-0000-4000-8000-000000000007',
  catTravel:              'c0000000-0000-4000-8000-000000000008',
  catHouseRemodeling:     'c0000000-0000-4000-8000-000000000009',
  // Projects
  projectTripFrance:      'd0000000-0000-4000-8000-000000000001',
  projectHouseRemodeling: 'd0000000-0000-4000-8000-000000000002',
  // Transactions
  txSalary:               'e0000000-0000-4000-8000-000000000001',
  txRent:                 'e0000000-0000-4000-8000-000000000002',
  txFood:                 'e0000000-0000-4000-8000-000000000003',
  txTransport:            'e0000000-0000-4000-8000-000000000004',
  txFlights:              'e0000000-0000-4000-8000-000000000005',
  txKitchen:              'e0000000-0000-4000-8000-000000000006',
  // Journal entries
  jeSalary:               'f0000000-0000-4000-8000-000000000001',
  jeRent:                 'f0000000-0000-4000-8000-000000000002',
  jeFood:                 'f0000000-0000-4000-8000-000000000003',
  jeTransport:            'f0000000-0000-4000-8000-000000000004',
  jeFlights:              'f0000000-0000-4000-8000-000000000005',
  jeKitchen:              'f0000000-0000-4000-8000-000000000006',
  jeTransfer:             'f0000000-0000-4000-8000-000000000007',
  // Scheduled bills
  sbSalary:               '60000000-0000-4000-8000-000000000001',
  sbRent:                 '60000000-0000-4000-8000-000000000002',
};

async function main() {
  console.log('🌱 Starting seed...');

  // ── 1. Generic ledger accounts ──────────────────────────────────────────────
  const ledgerIncome = await prisma.ledgerAccount.upsert({
    where: { id: IDS.ledgerIncome },
    update: {},
    create: {
      id: IDS.ledgerIncome,
      code: '4000',
      name: 'Income',
      type: LedgerAccountType.INCOME,
    },
  });

  const ledgerExpenses = await prisma.ledgerAccount.upsert({
    where: { id: IDS.ledgerExpenses },
    update: {},
    create: {
      id: IDS.ledgerExpenses,
      code: '5000',
      name: 'Expenses',
      type: LedgerAccountType.EXPENSE,
    },
  });

  // ── 2. Asset ledger accounts for each bank account ─────────────────────────
  const ledgerChecking = await prisma.ledgerAccount.upsert({
    where: { id: IDS.ledgerChecking },
    update: {},
    create: {
      id: IDS.ledgerChecking,
      code: '1000',
      name: 'Assets:Main Checking Account',
      type: LedgerAccountType.ASSET,
    },
  });

  const ledgerSavings = await prisma.ledgerAccount.upsert({
    where: { id: IDS.ledgerSavings },
    update: {},
    create: {
      id: IDS.ledgerSavings,
      code: '1001',
      name: 'Assets:Savings Account',
      type: LedgerAccountType.ASSET,
    },
  });

  const ledgerCash = await prisma.ledgerAccount.upsert({
    where: { id: IDS.ledgerCash },
    update: {},
    create: {
      id: IDS.ledgerCash,
      code: '1002',
      name: 'Assets:Cash Wallet',
      type: LedgerAccountType.ASSET,
    },
  });

  // ── 3. Accounts ─────────────────────────────────────────────────────────────
  await prisma.account.upsert({
    where: { id: IDS.accountChecking },
    update: {},
    create: {
      id: IDS.accountChecking,
      name: 'Main Checking Account',
      type: AccountType.CHECKING,
      currency: 'USD',
      initialBalance: new Decimal('1000.00'),
      ledgerAccountId: ledgerChecking.id,
    },
  });

  await prisma.account.upsert({
    where: { id: IDS.accountSavings },
    update: {},
    create: {
      id: IDS.accountSavings,
      name: 'Savings Account',
      type: AccountType.SAVINGS,
      currency: 'USD',
      initialBalance: new Decimal('5000.00'),
      ledgerAccountId: ledgerSavings.id,
    },
  });

  await prisma.account.upsert({
    where: { id: IDS.accountCash },
    update: {},
    create: {
      id: IDS.accountCash,
      name: 'Cash Wallet',
      type: AccountType.CASH,
      currency: 'USD',
      initialBalance: new Decimal('200.00'),
      ledgerAccountId: ledgerCash.id,
    },
  });

  // ── 4. Categories ──────────────────────────────────────────────────────────
  await prisma.category.upsert({ where: { id: IDS.catSalary }, update: {}, create: { id: IDS.catSalary, name: 'Salary', type: CategoryType.INCOME } });
  await prisma.category.upsert({ where: { id: IDS.catFreelance }, update: {}, create: { id: IDS.catFreelance, name: 'Freelance', type: CategoryType.INCOME } });
  await prisma.category.upsert({ where: { id: IDS.catInvestmentReturn }, update: {}, create: { id: IDS.catInvestmentReturn, name: 'Investment Return', type: CategoryType.INCOME } });
  await prisma.category.upsert({ where: { id: IDS.catFood }, update: {}, create: { id: IDS.catFood, name: 'Food', type: CategoryType.EXPENSE } });
  await prisma.category.upsert({ where: { id: IDS.catRent }, update: {}, create: { id: IDS.catRent, name: 'Rent', type: CategoryType.EXPENSE } });
  await prisma.category.upsert({ where: { id: IDS.catTransport }, update: {}, create: { id: IDS.catTransport, name: 'Transport', type: CategoryType.EXPENSE } });
  await prisma.category.upsert({ where: { id: IDS.catHealth }, update: {}, create: { id: IDS.catHealth, name: 'Health', type: CategoryType.EXPENSE } });
  await prisma.category.upsert({ where: { id: IDS.catTravel }, update: {}, create: { id: IDS.catTravel, name: 'Travel', type: CategoryType.EXPENSE } });
  await prisma.category.upsert({ where: { id: IDS.catHouseRemodeling }, update: {}, create: { id: IDS.catHouseRemodeling, name: 'House Remodeling', type: CategoryType.EXPENSE } });

  // ── 5. Projects ────────────────────────────────────────────────────────────
  await prisma.project.upsert({
    where: { id: IDS.projectTripFrance },
    update: {},
    create: {
      id: IDS.projectTripFrance,
      name: 'Trip to France',
      description: 'Summer vacation to Paris and Lyon',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
    },
  });

  await prisma.project.upsert({
    where: { id: IDS.projectHouseRemodeling },
    update: {},
    create: {
      id: IDS.projectHouseRemodeling,
      name: 'House Remodeling',
      description: 'Kitchen and living room renovation',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });

  // ── 6. Helper: upsert JournalEntry + Transaction ──────────────────────────
  async function upsertTransaction(opts: {
    txId: string;
    jeId: string;
    accountId: string;
    accountLedgerId: string;
    categoryId: string;
    projectId?: string;
    type: TransactionType;
    amount: string;
    description: string;
    date: string;
  }) {
    const amount = new Decimal(opts.amount);
    const entryDate = new Date(opts.date + 'T00:00:00.000Z');

    const debitLedgerId =
      opts.type === TransactionType.INCOME ? opts.accountLedgerId : ledgerExpenses.id;
    const creditLedgerId =
      opts.type === TransactionType.INCOME ? ledgerIncome.id : opts.accountLedgerId;
    const incomeCategoryLine = opts.type === TransactionType.INCOME ? opts.categoryId : undefined;
    const expenseCategoryLine = opts.type === TransactionType.EXPENSE ? opts.categoryId : undefined;

    const je = await prisma.journalEntry.upsert({
      where: { id: opts.jeId },
      update: {},
      create: {
        id: opts.jeId,
        entryDate,
        description: opts.description,
        sourceType: JournalEntrySourceType.SEED,
        status: JournalEntryStatus.POSTED,
        lines: {
          create: [
            {
              ledgerAccountId: debitLedgerId,
              debit: amount,
              credit: new Decimal(0),
              categoryId: expenseCategoryLine ?? null,
              projectId: opts.projectId ?? null,
            },
            {
              ledgerAccountId: creditLedgerId,
              debit: new Decimal(0),
              credit: amount,
              categoryId: incomeCategoryLine ?? null,
              projectId: opts.projectId ?? null,
            },
          ],
        },
      },
    });

    await prisma.transaction.upsert({
      where: { id: opts.txId },
      update: {},
      create: {
        id: opts.txId,
        accountId: opts.accountId,
        categoryId: opts.categoryId,
        projectId: opts.projectId ?? null,
        journalEntryId: je.id,
        type: opts.type,
        status: TransactionStatus.POSTED,
        amount,
        description: opts.description,
        transactionDate: entryDate,
      },
    });
  }

  // ── 7. Posted Transactions ─────────────────────────────────────────────────
  await upsertTransaction({
    txId: IDS.txSalary,
    jeId: IDS.jeSalary,
    accountId: IDS.accountChecking,
    accountLedgerId: ledgerChecking.id,
    categoryId: IDS.catSalary,
    type: TransactionType.INCOME,
    amount: '6000.00',
    description: 'Monthly salary - June 2026',
    date: '2026-06-01',
  });

  await upsertTransaction({
    txId: IDS.txRent,
    jeId: IDS.jeRent,
    accountId: IDS.accountChecking,
    accountLedgerId: ledgerChecking.id,
    categoryId: IDS.catRent,
    type: TransactionType.EXPENSE,
    amount: '1500.00',
    description: 'Monthly rent - June 2026',
    date: '2026-06-02',
  });

  await upsertTransaction({
    txId: IDS.txFood,
    jeId: IDS.jeFood,
    accountId: IDS.accountChecking,
    accountLedgerId: ledgerChecking.id,
    categoryId: IDS.catFood,
    type: TransactionType.EXPENSE,
    amount: '320.00',
    description: 'Grocery shopping - June 2026',
    date: '2026-06-05',
  });

  await upsertTransaction({
    txId: IDS.txTransport,
    jeId: IDS.jeTransport,
    accountId: IDS.accountChecking,
    accountLedgerId: ledgerChecking.id,
    categoryId: IDS.catTransport,
    type: TransactionType.EXPENSE,
    amount: '150.00',
    description: 'Monthly bus pass - June 2026',
    date: '2026-06-03',
  });

  await upsertTransaction({
    txId: IDS.txFlights,
    jeId: IDS.jeFlights,
    accountId: IDS.accountChecking,
    accountLedgerId: ledgerChecking.id,
    categoryId: IDS.catTravel,
    projectId: IDS.projectTripFrance,
    type: TransactionType.EXPENSE,
    amount: '800.00',
    description: 'Flights to France',
    date: '2026-06-10',
  });

  await upsertTransaction({
    txId: IDS.txKitchen,
    jeId: IDS.jeKitchen,
    accountId: IDS.accountChecking,
    accountLedgerId: ledgerChecking.id,
    categoryId: IDS.catHouseRemodeling,
    projectId: IDS.projectHouseRemodeling,
    type: TransactionType.EXPENSE,
    amount: '2500.00',
    description: 'Kitchen renovation materials',
    date: '2026-06-15',
  });

  // ── 8. Transfer: Checking → Savings ───────────────────────────────────────
  await prisma.journalEntry.upsert({
    where: { id: IDS.jeTransfer },
    update: {},
    create: {
      id: IDS.jeTransfer,
      entryDate: new Date('2026-06-20T00:00:00.000Z'),
      description: 'Transfer from Checking to Savings',
      sourceType: JournalEntrySourceType.TRANSFER,
      status: JournalEntryStatus.POSTED,
      lines: {
        create: [
          {
            ledgerAccountId: ledgerSavings.id,
            debit: new Decimal('500.00'),
            credit: new Decimal(0),
          },
          {
            ledgerAccountId: ledgerChecking.id,
            debit: new Decimal(0),
            credit: new Decimal('500.00'),
          },
        ],
      },
    },
  });

  // ── 9. Scheduled Bills ─────────────────────────────────────────────────────
  await prisma.scheduledBill.upsert({
    where: { id: IDS.sbSalary },
    update: {},
    create: {
      id: IDS.sbSalary,
      accountId: IDS.accountChecking,
      categoryId: IDS.catSalary,
      type: TransactionType.INCOME,
      amount: new Decimal('6000.00'),
      description: 'Monthly salary - July 2026',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      status: ScheduledBillStatus.SCHEDULED,
    },
  });

  await prisma.scheduledBill.upsert({
    where: { id: IDS.sbRent },
    update: {},
    create: {
      id: IDS.sbRent,
      accountId: IDS.accountChecking,
      categoryId: IDS.catRent,
      type: TransactionType.EXPENSE,
      amount: new Decimal('1500.00'),
      description: 'Monthly rent - July 2026',
      dueDate: new Date('2026-07-02T00:00:00.000Z'),
      status: ScheduledBillStatus.SCHEDULED,
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`   Ledger Accounts: Income (${ledgerIncome.id}), Expenses (${ledgerExpenses.id})`);
  console.log(`   Accounts: Checking (${IDS.accountChecking}), Savings (${IDS.accountSavings}), Cash (${IDS.accountCash})`);
  console.log(`   Categories: 3 income, 6 expense`);
  console.log(`   Projects: Trip to France (${IDS.projectTripFrance}), House Remodeling (${IDS.projectHouseRemodeling})`);
  console.log(`   Transactions: 6 posted`);
  console.log(`   Transfers: 1 (Checking → Savings)`);
  console.log(`   Scheduled Bills: 2`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
