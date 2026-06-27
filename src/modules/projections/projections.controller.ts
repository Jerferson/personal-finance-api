import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectionsService } from './projections.service';
import { BudgetProjectionQueryDto } from './dto/budget-projection-query.dto';

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
}
