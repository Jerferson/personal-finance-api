import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectionsService } from './projections.service';
import { BudgetProjectionQueryDto } from './dto/budget-projection-query.dto';
import { CashflowQueryDto } from './dto/cashflow-query.dto';

@ApiTags('Projections')
@Controller('projections')
export class ProjectionsController {
  constructor(private readonly projectionsService: ProjectionsService) {}

  @Get('budget')
  @ApiOperation({ summary: 'Get budget projection until a given date' })
  @ApiOkResponse({ description: 'Budget projection including scheduled bills' })
  getBudgetProjection(@Query() query: BudgetProjectionQueryDto) {
    return this.projectionsService.getBudgetProjection(query);
  }

  @Get('cashflow')
  @ApiOperation({ summary: 'Get month-by-month cashflow projection (chained balances)' })
  @ApiOkResponse({ description: 'Monthly cashflow projection for N months' })
  getCashflowProjection(@Query() query: CashflowQueryDto) {
    return this.projectionsService.getCashflowProjection(query);
  }
}
