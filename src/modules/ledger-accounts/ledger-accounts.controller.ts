import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LedgerAccountsService } from './ledger-accounts.service';
import { QueryLedgerAccountDto } from './dto/query-ledger-account.dto';

@ApiTags('Ledger Accounts')
@Controller('ledger-accounts')
export class LedgerAccountsController {
  constructor(private readonly ledgerAccountsService: LedgerAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all ledger accounts (paginated, sorted by code ASC)' })
  @ApiOkResponse({ description: 'Paginated list of ledger accounts' })
  findAll(@Query() query: QueryLedgerAccountDto) {
    return this.ledgerAccountsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger account by ID' })
  @ApiOkResponse({ description: 'Ledger account found' })
  findOne(@Param('id') id: string) {
    return this.ledgerAccountsService.findOne(id);
  }
}
