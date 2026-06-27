import { Decimal } from '@prisma/client/runtime/library';

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value.toString());
}

export function addDecimals(...values: Decimal[]): Decimal {
  return values.reduce((acc, val) => acc.add(val), new Decimal(0));
}

export function subtractDecimal(a: Decimal, b: Decimal): Decimal {
  return a.sub(b);
}

export function isPositive(value: Decimal): boolean {
  return value.greaterThan(0);
}

export function isZeroOrNegative(value: Decimal): boolean {
  return value.lessThanOrEqualTo(0);
}

export function roundToPercent(numerator: Decimal, denominator: Decimal): number {
  if (denominator.isZero()) return 0;
  return parseFloat(numerator.div(denominator).mul(100).toFixed(2));
}
