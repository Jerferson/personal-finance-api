import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeaders,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { IdempotencyGuard } from '../../common/idempotency/idempotency.guard';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @UseGuards(IdempotencyGuard)
  @Idempotent('transaction')
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiCreatedResponse({ description: 'Transaction created successfully' })
  create(@Body() dto: CreateTransactionDto, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.transactionsService.create(dto, idempotencyKey, req.path);
  }

  @Get()
  @ApiOperation({ summary: 'List transactions (paginated)' })
  @ApiOkResponse({ description: 'Paginated list of transactions' })
  findAll(@Query() query: QueryTransactionDto) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiOkResponse({ description: 'Transaction found' })
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction (description and projectId only)' })
  @ApiOkResponse({ description: 'Transaction updated' })
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, dto);
  }

  @Post(':id/void')
  @UseGuards(IdempotencyGuard)
  @Idempotent('transaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a transaction' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiOkResponse({ description: 'Transaction voided' })
  void(@Param('id') id: string, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.transactionsService.void(id, idempotencyKey, req.path);
  }
}
