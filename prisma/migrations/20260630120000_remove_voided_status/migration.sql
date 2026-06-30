-- Delete any existing VOIDED records before removing the enum value
DELETE FROM "transactions" WHERE status = 'VOIDED';
DELETE FROM "journal_entries" WHERE status = 'VOIDED';

-- Recreate TransactionStatus without VOIDED
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
CREATE TYPE "TransactionStatus" AS ENUM ('POSTED');
ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "TransactionStatus" USING "status"::text::"TransactionStatus";
DROP TYPE "TransactionStatus_old";

-- Recreate JournalEntryStatus without VOIDED
ALTER TYPE "JournalEntryStatus" RENAME TO "JournalEntryStatus_old";
CREATE TYPE "JournalEntryStatus" AS ENUM ('POSTED');
ALTER TABLE "journal_entries" ALTER COLUMN "status" TYPE "JournalEntryStatus" USING "status"::text::"JournalEntryStatus";
DROP TYPE "JournalEntryStatus_old";
