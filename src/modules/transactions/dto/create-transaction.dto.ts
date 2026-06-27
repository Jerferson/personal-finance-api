import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 'uuid-of-account' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: '150.00', description: 'Amount as string, must be > 0' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ example: '2024-01-15', description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  transactionDate: string;

  @ApiProperty({ example: 'Monthly groceries' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'uuid-of-project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
