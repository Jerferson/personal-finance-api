# Personal Finance Manager API

A production-quality REST API for managing personal finances, built with **NestJS**, **TypeScript**, **PostgreSQL**, and **Prisma**. The system uses a simplified ledger model with internal double-entry bookkeeping.

---

## Project Overview

Personal Finance Manager is a backend challenge that goes beyond simple CRUD operations. It demonstrates:

- **Simplified ledger architecture** with internal double-entry journal entries
- **Financial integrity** through validated posted records with atomic delete
- **Budget projection** using scheduled bills separate from posted transactions
- **Idempotent financial operations** to prevent duplicate records on retries
- **Clean architecture** with thin controllers, rich service layer, and shared ledger module

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| Validation | class-validator + class-transformer |
| Documentation | Swagger / OpenAPI |
| Testing | Jest |
| Containerization | Docker + Docker Compose |

---

## Main Features

- **Account management** — CHECKING, SAVINGS, CASH accounts with ledger-based balance
- **Category classification** — INCOME and EXPENSE categories for business reporting
- **Project tracking** — Group expenses by goals (vacation, renovation, etc.)
- **Transactions** — POSTED financial records with internal double-entry journal
- **Scheduled bills** — Future income and expenses for budget projection
- **Transfers** — Move money between accounts (creates journal entries directly)
- **Balance endpoint** — Real-time account balance from ledger lines (includes transfers)
- **Monthly reports** — Expenses by category with percentages; income/expense summary
- **Budget projection** — Current balance + scheduled bills until a future date
- **Idempotency** — Duplicate-safe financial commands via `Idempotency-Key` header
- **Journal entries** — Read-only audit trail of all financial movements (transactions and transfers)

---

## Architecture Overview V1

[![Domain Model Diagram](https://drive.google.com/thumbnail?id=1Stresd7tsN9j5Wm2swfvQSWUN0naQ_Yr&sz=w1200)](https://app.diagrams.net/#G1Stresd7tsN9j5Wm2swfvQSWUN0naQ_Yr#%7B%22pageId%22%3A%22IEUq0kYoGwujQ4KiPO6B%22%7D)

> Click the image to open the interactive diagram in diagrams.net.

```
┌─────────────────────────────────────────────────────────────┐
│                        REST API Layer                        │
│  /accounts  /categories  /projects  /transactions           │
│  /scheduled-bills  /transfers  /reports  /projections       │
│  /journal-entries  /ledger-accounts                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Domain Services                           │
│  AccountsService  TransactionsService  ScheduledBillsService│
│  ReportsService   ProjectionsService   TransfersService     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Shared Ledger Module                      │
│  JournalEntryService  LedgerBalanceService                  │
│  LedgerAccountService                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Prisma + PostgreSQL                     │
│  Account  Transaction  JournalEntry  JournalLine            │
│  ScheduledBill  LedgerAccount  Category  Project            │
│  IdempotencyKey                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key architectural decision: user-facing simplicity + internal accounting

The user sends simple transactions:
```json
{ "accountId": "...", "categoryId": "...", "type": "EXPENSE", "amount": "100.00", "description": "..." }
```

Internally, the system creates a balanced journal entry:
```
Debit  Expenses (generic)   100.00
Credit Assets:Checking      100.00
```

This keeps the API simple while preserving double-entry accounting consistency.

---

## Domain Model

```
Account ──────────────── has one ──────────────── LedgerAccount (ASSET)
   │
   ├── has many ── Transaction ──── creates ────── JournalEntry
   │                    │                              │
   │                    └── has one Category           └── has many JournalLines
   │
   └── has many ── ScheduledBill ── when posted ──────── Transaction
```

### Entity summary

| Entity | Purpose |
|---|---|
| `Account` | User's bank/cash account (CHECKING, SAVINGS, CASH) |
| `LedgerAccount` | Internal Chart of Accounts node (ASSET, INCOME, EXPENSE) |
| `Category` | Business classification for reporting (Salary, Food, Rent...) |
| `Project` | Goal-based expense grouping (Trip, Renovation...) |
| `Transaction` | User-facing posted financial record |
| `JournalEntry` | Internal double-entry header (1:1 with Transaction or Transfer) |
| `JournalLine` | Debit/credit lines of a JournalEntry |
| `ScheduledBill` | Future income/expense (affects only projection until posted) |
| `IdempotencyKey` | Prevents duplicate financial records on retries |

---

## Business Rules

### Transactions
- `amount` must be positive and never zero
- Category type must match transaction type (INCOME category → INCOME transaction)
- Only `description` and `projectId` are editable after creation
- Deleting a transaction removes it and its associated journal entry atomically
- To correct a financial record: delete + create new transaction

### Accounts
- Cannot be deleted if linked to transactions, scheduled bills, or journal lines
- Balance is calculated from internal journal lines (includes transfers)

### Scheduled Bills
- SCHEDULED → POSTED: creates a Transaction + JournalEntry atomically
- SCHEDULED → CANCELLED: allowed at any time
- POSTED bills cannot be cancelled; delete the linked transaction instead
- Only SCHEDULED bills can be edited

### Journal Entries
- Must have at least two lines
- Total debits must equal total credits
- Read-only: created internally by transactions and transfers, not editable via API

### Transfers
- Creates a JournalEntry directly (no Transaction record)
- Does not appear in GET /transactions
- Auditable via GET /journal-entries?sourceType=TRANSFER
- Affects account balance (appears as journal line)

---

## API Documentation

Swagger UI is available at: **http://localhost:3000/docs**

### Endpoints summary

#### Accounts
```
POST   /accounts
GET    /accounts?page=1&limit=20
GET    /accounts/:id
PATCH  /accounts/:id
DELETE /accounts/:id
GET    /accounts/:id/balance?date=YYYY-MM-DD
```

#### Categories
```
POST   /categories
GET    /categories?page=1&limit=20
GET    /categories/:id
PATCH  /categories/:id
DELETE /categories/:id
```

#### Projects
```
POST   /projects
GET    /projects?page=1&limit=20
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
GET    /projects/:id/summary
```

#### Transactions
```
POST   /transactions              (Idempotency-Key required)
GET    /transactions?accountId=&categoryId=&projectId=&type=&status=&startDate=&endDate=&page=&limit=
GET    /transactions/:id
PATCH  /transactions/:id
DELETE /transactions/:id
```

#### Scheduled Bills
```
POST   /scheduled-bills           (Idempotency-Key required)
GET    /scheduled-bills?accountId=&categoryId=&projectId=&type=&status=&startDate=&endDate=&page=&limit=
GET    /scheduled-bills/:id
PATCH  /scheduled-bills/:id
POST   /scheduled-bills/:id/post
POST   /scheduled-bills/:id/cancel
```

#### Transfers
```
GET    /transfers?page=&limit=
POST   /transfers                 (Idempotency-Key required)
```

#### Statement (unified view)
```
GET    /statement?mode=initial|past|future&skip=0&limit=20
```

Modes:
- `initial` (default) — returns the last 20 past entries + next 3 upcoming scheduled bills in one call
- `past` — posted transactions and transfers, ordered by date descending, paginated via `skip`/`limit`
- `future` — upcoming scheduled bills (dueDate ≥ today, status SCHEDULED), ordered by due date ascending

#### Journal Entries (read-only)
```
GET    /journal-entries?status=&sourceType=&startDate=&endDate=&page=&limit=
GET    /journal-entries/:id
```

#### Ledger Accounts (read-only)
```
GET    /ledger-accounts
GET    /ledger-accounts/:id
```

#### Reports
```
GET    /reports/monthly-expenses?month=YYYY-MM&accountId=
GET    /reports/monthly-summary?month=YYYY-MM
```

#### Projections
```
GET    /projections/budget?until=YYYY-MM-DD&accountId=
GET    /projections/cashflow?months=N
```

### Idempotency

Financial commands require the `Idempotency-Key` header:
```http
POST /transactions
Idempotency-Key: my-unique-client-key-123
```
- Same key + same body → returns original response (duplicate-safe)
- Same key + different body → 409 Conflict

### Monetary values

All monetary values are returned as **strings** to avoid floating-point precision issues:
```json
{ "amount": "1200.50", "balance": "3700.00" }
```

### Error format
```json
{
  "statusCode": 400,
  "message": "Category type must match transaction type",
  "error": "Bad Request",
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/transactions"
}
```

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 16 running on localhost:5432

### Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your DATABASE_URL

# Apply migrations
npm run prisma:migrate

# Run seed data
npm run prisma:seed

# Start development server
npm run start:dev
```

The API will be available at: `http://localhost:3000`
Swagger docs at: `http://localhost:3000/docs`

---

## How to Run with Docker

```bash
docker compose up --build
```

This will:
1. Start PostgreSQL 16
2. Build the NestJS application
3. Apply database migrations (`prisma migrate deploy`)
4. Run seed data (`prisma db seed`) — idempotent, safe to re-run
5. Start the API server on port 3000

> The seed is idempotent (uses upsert with stable IDs). Running it multiple times is safe.

---

## How to Run Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Test coverage

Unit tests cover the critical financial rules:

| Test suite | What it tests |
|---|---|
| `LedgerBalanceService` | Balance calculation from journal lines, date filtering |
| `JournalEntryService` | Double-entry validation, unbalanced entry rejection |
| `ProjectionsService` | Scheduled bill inclusion/exclusion, date filtering, CANCELLED ignored |
| Transaction business rules | Amount validation, category type mismatch, ledger line derivation |

---

## Seed Data

The seed creates realistic demonstration data:

### Accounts
| Account | Type | Initial Balance |
|---|---|---|
| Main Checking Account | CHECKING | $1,000.00 |
| Savings Account | SAVINGS | $5,000.00 |
| Cash Wallet | CASH | $200.00 |

### Categories
**Income:** Salary, Freelance, Investment Return
**Expense:** Food, Rent, Transport, Health, Travel, House Remodeling

### Projects
- Trip to France (Jul/2026)
- House Remodeling (Jan–Dec/2026)

### Posted Transactions (Jun/2026)
- Salary +$6,000 → Checking
- Rent −$1,500 → Checking
- Food −$320 → Checking
- Transport −$150 → Checking
- Flights to France −$800 → Checking (Project: Trip to France)
- Kitchen renovation −$2,500 → Checking (Project: House Remodeling)

### Transfer
- $500 Checking → Savings

### Scheduled Bills
- Future salary $6,000 (due Jul/1/2026)
- Future rent $1,500 (due Jul/2/2026)

---

## Architectural Decisions

### Why PostgreSQL?

Financial data requires strong consistency, relational integrity, and complex queries (reports, projections, filtered aggregations). PostgreSQL's ACID guarantees, decimal precision, and query planner make it the right choice for this domain.

### Why calculate balance from journal lines?

Account balances are derived from the internal ledger (journal lines), never stored as mutable state. This approach:
- Ensures transfers immediately affect balances without special-casing
- Makes every balance auditable: "how did we arrive at this number?"
- Eliminates the risk of double-state inconsistency
- Follows standard accounting principles

`balance = initialBalance + totalDebits - totalCredits` on the account's ASSET ledger account.

### Why internal double-entry if the user just sees transactions?

The user interacts with a simple model (account + category + type + amount). Internally, every posted transaction creates a balanced journal entry. This demonstrates General Ledger concepts while keeping the API usable. The split also means transfers (which don't fit the simple income/expense model) can be represented correctly without a fake transaction type.

### Why separate ScheduledBill from Transaction?

Scheduled bills represent future *intentions*, not confirmed financial facts. Mixing them with posted transactions would contaminate balance calculations and reports. By keeping them separate:
- Reports only show confirmed posted records
- Projections clearly add scheduled amounts on top of real balance
- Posting a bill creates a real Transaction + JournalEntry in one atomic operation

### Why idempotency?

Financial operations must be safe to retry. Network failures, browser double-clicks, or timeout retries should not create duplicate transactions. Every financial command requires an `Idempotency-Key` header. The key + endpoint + request hash combination is stored in the same database transaction as the financial record.

### Why hard delete for transactions?

Deleting a transaction removes it and its associated journal entry atomically in a single database transaction. This keeps the model simple for the challenge scope: if a transaction was created by mistake, the user deletes it and creates a new one with the correct data. Journal entries created by transfers remain in the database and are auditable via `GET /journal-entries`. In a production system, a soft-delete or void approach (marking as VOIDED without removing records) would be preferable to preserve a complete audit trail and support compliance requirements.

---

## Trade-offs

| Decision | Consequence | Production alternative |
|---|---|---|
| No authentication | Simpler focus on financial domain | JWT + guards + userId on all entities |
| Hard delete for transactions | Simple correction flow (delete + recreate) | Soft-delete/void to preserve full audit trail |
| Generic Income/Expenses ledger accounts | Simpler chart of accounts | Per-category ledger accounts for detailed reporting |
| Balance calculated on request | Simple, always accurate | Balance snapshots for high-volume accounts |
| No rate limiting | Fine for challenge scope | Redis + throttler guard |
| Idempotency race window under unique constraint | Acceptable for single-instance | Optimistic locking or distributed lock (Redis) |
| Transfers do not support projectId | Simplifies the model | Add projectId to transfer DTO |
| CREDIT_CARD and INVESTMENT accounts excluded | Keeps all accounts as ASSET type | Add liability/investment balance logic |

---

## Scalability Considerations

- **Pagination** on all list endpoints (`?page=1&limit=20`, max 100)
- **Database indexes** on accountId, transactionDate, status, categoryId, dueDate, entryDate
- **Composite indexes** on `(accountId, transactionDate)` and `(status, transactionDate)` for filtered queries
- **Balance snapshots** for accounts with thousands of transactions (cache `currentBalance` periodically)
- **Read replicas** for report and projection queries (heavy aggregations)
- **Redis cache** for frequently requested monthly reports
- **Background jobs** for projection calculations in large-scale deployments
- **Multi-tenancy** by adding `userId`/`tenantId` to all entities
- **Observability** with structured logging, metrics, and distributed tracing
- **Rate limiting** and authentication for production

---

## AI Usage

AI tools were used as support during the development process for:
- Brainstorming architecture options and trade-offs
- Organizing and validating business rules before implementation
- Generating boilerplate code (DTOs, module structure)
- Improving documentation quality and structure
- Suggesting test scenarios for financial edge cases

All generated code was reviewed, adapted, and validated manually. The main domain decisions — ledger model, idempotency mechanics, status state machine, balance calculation from journal lines, and the separation of ScheduledBill from Transaction — were intentionally designed, discussed, and understood by the author.
# personal-finance-api
