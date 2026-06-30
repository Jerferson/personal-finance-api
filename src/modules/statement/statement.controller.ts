import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatementService } from './statement.service';
import { StatementQueryDto, StatementMode } from './dto/statement-query.dto';

@ApiTags('statement')
@Controller('statement')
export class StatementController {
  constructor(private readonly statementService: StatementService) {}

  @Get()
  @ApiOperation({ summary: 'Get statement entries (unified transactions, transfers, scheduled bills)' })
  @ApiOkResponse({ description: 'Statement entries' })
  get(@Query() query: StatementQueryDto) {
    const { mode, skip, limit } = query;

    if (mode === StatementMode.PAST) {
      return this.statementService.getPast(skip, limit);
    }

    if (mode === StatementMode.FUTURE) {
      return this.statementService.getFuture(skip, limit);
    }

    return this.statementService.getInitial();
  }
}
