import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeaders,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { IdempotencyGuard } from '../../common/idempotency/idempotency.guard';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @UseGuards(IdempotencyGuard)
  @Idempotent('transfer')
  @ApiOperation({ summary: 'Create a transfer between accounts' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiCreatedResponse({ description: 'Transfer created successfully' })
  create(@Body() dto: CreateTransferDto, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.transfersService.create(dto, idempotencyKey, req.path);
  }
}
