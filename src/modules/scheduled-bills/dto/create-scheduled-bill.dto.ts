import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateScheduledBillDto {
  @ApiProperty({ example: 'uuid-of-account' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: '500.00', description: 'Amount as string, must be > 0' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ example: 'Rent payment' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: '2024-02-01', description: 'Due date in YYYY-MM-DD format' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ example: 'uuid-of-project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
