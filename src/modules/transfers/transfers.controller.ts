import {
  Body,
  Controller,
  Get,
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
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IdempotencyGuard } from '../../common/idempotency/idempotency.guard';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @ApiOperation({ summary: 'List transfers (paginated)' })
  @ApiOkResponse({ description: 'Paginated list of transfers' })
  findAll(@Query() query: PaginationDto) {
    return this.transfersService.findAll(query.page, query.limit);
  }

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
