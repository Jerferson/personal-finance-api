import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumberString, IsString, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: 'uuid-of-source-account' })
  @IsUUID()
  fromAccountId: string;

  @ApiProperty({ example: 'uuid-of-destination-account' })
  @IsUUID()
  toAccountId: string;

  @ApiProperty({ example: '250.00', description: 'Amount as string, must be > 0' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ example: '2024-01-20', description: 'Transfer date in YYYY-MM-DD format' })
  @IsDateString()
  transferDate: string;

  @ApiProperty({ example: 'Transfer to savings' })
  @IsNotEmpty()
  @IsString()
  description: string;
}
