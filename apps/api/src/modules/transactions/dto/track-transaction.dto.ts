import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { TransactionType } from '@avahui/shared';

export class TrackTransactionDto {
  @ApiProperty({
    example: '0x88a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a 66-character hex transaction hash',
  })
  txHash: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.CONTRIBUTE })
  @IsEnum(TransactionType)
  txType: TransactionType;

  @ApiProperty({ example: '0x9A676e781A523b5d0C0e43731313A708CB607508' })
  @IsString()
  contractAddress: string;

  @ApiPropertyOptional({ example: '0x71C95911E9a5D330f4D621842EC243EE13432921' })
  @IsOptional()
  @IsString()
  senderAddress?: string;

  @ApiPropertyOptional({ description: 'UUID of the circle if applicable' })
  @IsOptional()
  @IsString()
  circleId?: string;
}

