import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum StatementMode {
  INITIAL = 'initial',
  PAST = 'past',
  FUTURE = 'future',
}

export class StatementQueryDto {
  @ApiPropertyOptional({ enum: StatementMode, default: StatementMode.INITIAL })
  @IsOptional()
  @IsEnum(StatementMode)
  mode: StatementMode = StatementMode.INITIAL;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
