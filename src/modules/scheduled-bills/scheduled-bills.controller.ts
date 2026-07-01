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
import { ScheduledBillsService } from './scheduled-bills.service';
import { CreateScheduledBillDto } from './dto/create-scheduled-bill.dto';
import { UpdateScheduledBillDto } from './dto/update-scheduled-bill.dto';
import { QueryScheduledBillDto } from './dto/query-scheduled-bill.dto';

@ApiTags('scheduled-bills')
@Controller('scheduled-bills')
export class ScheduledBillsController {
  constructor(private readonly scheduledBillsService: ScheduledBillsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled bill' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiCreatedResponse({ description: 'Scheduled bill created successfully' })
  create(@Body() dto: CreateScheduledBillDto, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.scheduledBillsService.create(dto, idempotencyKey);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Post a scheduled bill (creates a transaction)' })
  @ApiOkResponse({ description: 'Scheduled bill posted' })
  post(@Param('id') id: string) {
    return this.scheduledBillsService.post(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled bill (only when SCHEDULED)' })
  @ApiNoContentResponse({ description: 'Scheduled bill deleted' })
  delete(@Param('id') id: string) {
    return this.scheduledBillsService.delete(id);
  }

}
