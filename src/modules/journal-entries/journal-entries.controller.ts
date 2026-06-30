import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JournalEntriesService } from './journal-entries.service';
import { QueryJournalEntryDto } from './dto/query-journal-entry.dto';

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

}
