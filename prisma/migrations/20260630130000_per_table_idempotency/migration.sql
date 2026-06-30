-- Add unique constraint to journal_entries.idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_idempotency_key_key"
  ON "journal_entries"("idempotency_key");

-- Add idempotency_key to scheduled_bills
ALTER TABLE "scheduled_bills" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "scheduled_bills_idempotency_key_key"
  ON "scheduled_bills"("idempotency_key");

-- Drop idempotency_keys table
DROP TABLE "idempotency_keys";
