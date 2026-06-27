import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class MonthlyExpensesQueryDto {
  @ApiProperty({
    example: '2026-06',
    description: 'Month in YYYY-MM format',
  })
  @IsString()
  month: string;

  @ApiPropertyOptional({
    example: 'uuid-account-id',
    description: 'Filter by account ID',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
