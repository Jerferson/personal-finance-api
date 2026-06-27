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
import { ScheduledBillsService } from './scheduled-bills.service';
import { CreateScheduledBillDto } from './dto/create-scheduled-bill.dto';
import { UpdateScheduledBillDto } from './dto/update-scheduled-bill.dto';
import { QueryScheduledBillDto } from './dto/query-scheduled-bill.dto';
import { IdempotencyGuard } from '../../common/idempotency/idempotency.guard';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('scheduled-bills')
@Controller('scheduled-bills')
export class ScheduledBillsController {
  constructor(private readonly scheduledBillsService: ScheduledBillsService) {}

  @Post()
  @UseGuards(IdempotencyGuard)
  @Idempotent('scheduled-bill')
  @ApiOperation({ summary: 'Create a new scheduled bill' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiCreatedResponse({ description: 'Scheduled bill created successfully' })
  create(@Body() dto: CreateScheduledBillDto, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.scheduledBillsService.create(dto, idempotencyKey, req.path);
  }

  @Get()
  @ApiOperation({ summary: 'List scheduled bills (paginated)' })
  @ApiOkResponse({ description: 'Paginated list of scheduled bills' })
  findAll(@Query() query: QueryScheduledBillDto) {
    return this.scheduledBillsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scheduled bill by ID' })
  @ApiOkResponse({ description: 'Scheduled bill found' })
  findOne(@Param('id') id: string) {
    return this.scheduledBillsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scheduled bill (only when SCHEDULED)' })
  @ApiOkResponse({ description: 'Scheduled bill updated' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduledBillDto) {
    return this.scheduledBillsService.update(id, dto);
  }

  @Post(':id/post')
  @UseGuards(IdempotencyGuard)
  @Idempotent('scheduled-bill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Post a scheduled bill (creates a transaction)' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiOkResponse({ description: 'Scheduled bill posted' })
  post(@Param('id') id: string, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.scheduledBillsService.post(id, idempotencyKey, req.path);
  }

  @Post(':id/cancel')
  @UseGuards(IdempotencyGuard)
  @Idempotent('scheduled-bill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a scheduled bill' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiOkResponse({ description: 'Scheduled bill cancelled' })
  cancel(@Param('id') id: string, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.scheduledBillsService.cancel(id, idempotencyKey, req.path);
  }
}
