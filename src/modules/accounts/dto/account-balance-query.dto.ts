import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AccountBalanceQueryDto {
  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'Date to calculate balance up to (YYYY-MM-DD). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
