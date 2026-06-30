import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
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
  @ApiOperation({ summary: 'Create a transfer between accounts' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiCreatedResponse({ description: 'Transfer created successfully' })
  create(@Body() dto: CreateTransferDto, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.transfersService.create(dto, idempotencyKey);
  }
}
