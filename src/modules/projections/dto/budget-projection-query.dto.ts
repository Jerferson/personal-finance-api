import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class BudgetProjectionQueryDto {
  @ApiProperty({
    example: '2026-12-31',
    description: 'Project budget until this date (YYYY-MM-DD)',
  })
  @IsDateString()
  until: string;

  @ApiPropertyOptional({
    example: 'uuid-account-id',
    description: 'Filter by account ID',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
