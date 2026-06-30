export type StatementEntryType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type StatementSourceType = 'TRANSACTION' | 'SCHEDULED_BILL' | 'TRANSFER';
export type StatementStatus = 'POSTED' | 'SCHEDULED';

export class StatementEntryDto {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: StatementEntryType;
  sourceType: StatementSourceType;
  status: StatementStatus;
  isScheduled: boolean;
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  projectId?: string;
  projectName?: string;
  relatedAccountId?: string;
  relatedAccountName?: string;
  transactionId?: string;
  scheduledBillId?: string;
}

export class StatementInitialResponseDto {
  future: StatementEntryDto[];
  past: StatementEntryDto[];
  hasMoreFuture: boolean;
  hasMorePast: boolean;
}

export class StatementPageResponseDto {
  entries: StatementEntryDto[];
  hasMore: boolean;
}
