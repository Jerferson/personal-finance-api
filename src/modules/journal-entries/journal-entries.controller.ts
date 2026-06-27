import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeaders,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JournalEntriesService } from './journal-entries.service';
import { QueryJournalEntryDto } from './dto/query-journal-entry.dto';
import { IdempotencyGuard } from '../../common/idempotency/idempotency.guard';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('journal-entries')
@Controller('journal-entries')
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  @ApiOperation({ summary: 'List journal entries (paginated)' })
  @ApiOkResponse({ description: 'Paginated list of journal entries' })
  findAll(@Query() query: QueryJournalEntryDto) {
    return this.journalEntriesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a journal entry by ID' })
  @ApiOkResponse({ description: 'Journal entry found' })
  findOne(@Param('id') id: string) {
    return this.journalEntriesService.findOne(id);
  }

  @Post(':id/void')
  @UseGuards(IdempotencyGuard)
  @Idempotent('journal-entry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a journal entry (only for non-transaction entries)' })
  @ApiHeaders([{ name: 'Idempotency-Key', required: true }])
  @ApiOkResponse({ description: 'Journal entry voided' })
  void(@Param('id') id: string, @Req() req: Request) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.journalEntriesService.void(id, idempotencyKey, req.path);
  }
}
