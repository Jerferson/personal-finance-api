import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IdempotencyConflictError } from '../errors/domain.errors';

export interface IdempotencyRunOptions {
  key: string;
  endpoint: string;
  body: unknown;
  resourceType: string;
}

export interface IdempotencyResult<T> {
  data: T;
  statusCode: number;
  fromCache: boolean;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  private computeHash(method: string, path: string, body: unknown): string {
    const payload = JSON.stringify({ method, path, body: body ?? {} });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async run<T>(
    options: IdempotencyRunOptions,
    fn: () => Promise<{ data: T; statusCode: number; resourceId?: string }>,
  ): Promise<IdempotencyResult<T>> {
    const { key, endpoint, body, resourceType } = options;
    const requestHash = this.computeHash('POST', endpoint, body);

    // 1. Check if key already exists for this endpoint
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_endpoint: { key, endpoint } },
    });

    if (existing) {
      if (existing.requestHash === requestHash) {
        // Same request — return cached response
        return {
          data: existing.responseBody as T,
          statusCode: existing.statusCode,
          fromCache: true,
        };
      } else {
        // Same key, different body — conflict
        throw new IdempotencyConflictError();
      }
    }

    // 2. Execute operation inside a transaction, saving idempotency record in the same tx
    let resultData: T;
    let resultStatusCode: number;
    let resultResourceId: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      const result = await fn();
      resultData = result.data;
      resultStatusCode = result.statusCode;
      resultResourceId = result.resourceId;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7-day TTL

      await tx.idempotencyKey.create({
        data: {
          key,
          endpoint,
          requestHash,
          responseBody: resultData as object,
          statusCode: resultStatusCode,
          resourceType,
          resourceId: resultResourceId ?? null,
          expiresAt,
        },
      });
    });

    return {
      data: resultData!,
      statusCode: resultStatusCode!,
      fromCache: false,
    };
  }
}
