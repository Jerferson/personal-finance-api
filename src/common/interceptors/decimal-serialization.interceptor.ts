import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Prisma Decimal — convert to string
  if (value instanceof Decimal) {
    return value.toFixed(2);
  }

  // Date — keep as ISO string (let Nest serialize it)
  if (value instanceof Date) {
    return value;
  }

  // Array — recurse each element
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  // Plain object — recurse each property
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      result[key] = serializeValue((value as Record<string, unknown>)[key]);
    }
    return result;
  }

  return value;
}

@Injectable()
export class DecimalSerializationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeValue(data)));
  }
}
