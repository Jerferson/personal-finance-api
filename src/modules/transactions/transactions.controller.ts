import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeaders,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiCreatedResponse({ description: 'Transaction created successfully' })
  create(@Body() dto: CreateTransactionDto, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.transactionsService.create(dto, idempotencyKey);
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
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiOkResponse({ description: 'Transaction updated' })
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiNoContentResponse({ description: 'Transaction deleted' })
  delete(@Param('id') id: string) {
    return this.transactionsService.delete(id);
  }
}
