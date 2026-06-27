import { ApiPropertyOptional } from '@nestjs/swagger';
import { JournalEntrySourceType, JournalEntryStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryJournalEntryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: JournalEntryStatus })
  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  @ApiPropertyOptional({ enum: JournalEntrySourceType })
  @IsOptional()
  @IsEnum(JournalEntrySourceType)
  sourceType?: JournalEntrySourceType;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Filter from this entry date (inclusive)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Filter up to this entry date (inclusive)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
