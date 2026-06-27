import { InvalidDateFormatError } from '../errors/domain.errors';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value: string): Date {
  if (!DATE_REGEX.test(value)) {
    throw new InvalidDateFormatError();
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    throw new InvalidDateFormatError();
  }
  return date;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(yearMonth: string): Date {
  return parseDate(`${yearMonth}-01`);
}

export function endOfMonth(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getDate();
  return endOfDay(parseDate(`${yearMonth}-${String(lastDay).padStart(2, '0')}`));
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function formatDateIso(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isValidYearMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}
