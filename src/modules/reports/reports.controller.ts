import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { MonthlyExpensesQueryDto } from './dto/monthly-expenses-query.dto';
import { MonthlySummaryQueryDto } from './dto/monthly-summary-query.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly-expenses')
  @ApiOperation({ summary: 'Get monthly expenses grouped by category' })
  @ApiOkResponse({ description: 'Monthly expenses by category' })
  getMonthlyExpenses(@Query() query: MonthlyExpensesQueryDto) {
    return this.reportsService.getMonthlyExpenses(query);
  }

  @Get('monthly-summary')
  @ApiOperation({ summary: 'Get monthly income/expense summary' })
  @ApiOkResponse({ description: 'Monthly income vs expense summary' })
  getMonthlySummary(@Query() query: MonthlySummaryQueryDto) {
    return this.reportsService.getMonthlySummary(query);
  }
}
