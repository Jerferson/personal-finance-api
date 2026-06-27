import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IDEMPOTENT_KEY } from './idempotent.decorator';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isIdempotent = this.reflector.getAllAndOverride(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isIdempotent) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['idempotency-key'];

    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new BadRequestException('Idempotency-Key header is required for this operation');
    }

    return true;
  }
}
