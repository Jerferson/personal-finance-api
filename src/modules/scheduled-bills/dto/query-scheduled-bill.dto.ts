import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduledBillStatus, TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryScheduledBillDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'uuid-of-account' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: ScheduledBillStatus })
  @IsOptional()
  @IsEnum(ScheduledBillStatus)
  status?: ScheduledBillStatus;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Filter from this due date (inclusive)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Filter up to this due date (inclusive)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
