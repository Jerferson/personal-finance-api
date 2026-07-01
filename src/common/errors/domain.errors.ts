import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class AccountNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Account with id '${id}' not found`);
  }
}

export class AccountHasLinkedRecordsError extends ConflictException {
  constructor() {
    super('Account cannot be deleted because it has linked transactions, scheduled bills or journal lines');
  }
}

export class CategoryNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Category with id '${id}' not found`);
  }
}

export class CategoryHasLinkedRecordsError extends ConflictException {
  constructor() {
    super('Category cannot be deleted because it has linked transactions or scheduled bills');
  }
}

export class CategoryTypeMismatchError extends BadRequestException {
  constructor() {
    super('Category type must match transaction type');
  }
}

export class ProjectNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Project with id '${id}' not found`);
  }
}

export class ProjectHasLinkedRecordsError extends ConflictException {
  constructor() {
    super('Project cannot be deleted because it has linked transactions or scheduled bills');
  }
}

export class ProjectDateRangeError extends BadRequestException {
  constructor() {
    super('endDate must be greater than or equal to startDate');
  }
}

export class TransactionNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Transaction with id '${id}' not found`);
  }
}

export class TransactionNotEditableError extends BadRequestException {
  constructor() {
    super('Only description and projectId can be updated on a posted transaction');
  }
}

export class ScheduledBillNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Scheduled bill with id '${id}' not found`);
  }
}

export class ScheduledBillNotScheduledError extends BadRequestException {
  constructor(action: string) {
    super(`Cannot ${action} a scheduled bill that is not in SCHEDULED status`);
  }
}

export class ScheduledBillAlreadyPostedError extends BadRequestException {
  constructor() {
    super('Posted scheduled bills cannot be directly cancelled. Delete the linked transaction instead');
  }
}

export class JournalEntryNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Journal entry with id '${id}' not found`);
  }
}

export class UnbalancedJournalEntryError extends BadRequestException {
  constructor() {
    super('Journal entry is not balanced: total debits must equal total credits');
  }
}

export class InvalidJournalLineError extends BadRequestException {
  constructor() {
    super('Each journal line must have either debit or credit greater than zero, but not both');
  }
}

export class InvalidAmountError extends BadRequestException {
  constructor() {
    super('Amount must be greater than zero');
  }
}

export class InvalidDateFormatError extends BadRequestException {
  constructor() {
    super('Invalid date format. Use YYYY-MM-DD');
  }
}

export class LedgerAccountNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Ledger account with id '${id}' not found`);
  }
}

export class TransferSameAccountError extends BadRequestException {
  constructor() {
    super('Source and destination accounts must be different');
  }
}

export class UnprocessableError extends UnprocessableEntityException {
  constructor(message: string) {
    super(message);
  }
}
