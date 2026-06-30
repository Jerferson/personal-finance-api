-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "scheduled_bills_category_id_idx" ON "scheduled_bills"("category_id");

-- CreateIndex
CREATE INDEX "scheduled_bills_project_id_idx" ON "scheduled_bills"("project_id");

-- CreateIndex
CREATE INDEX "scheduled_bills_status_due_date_idx" ON "scheduled_bills"("status", "due_date");

-- CreateIndex
CREATE INDEX "transactions_status_type_transaction_date_idx" ON "transactions"("status", "type", "transaction_date");
