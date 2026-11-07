import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AllocationMode, CircleStatus } from '@avahui/shared';

export class CreateCircleDraftDto {
  @ApiProperty({ example: 'Hụi Tiết Kiệm Builders UniHack' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'Dây hụi 5 người chế độ đấu giá chiết khấu tại Avalanche UniHack 2026 TP.HCM.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '0x71C95911E9a5D330f4D621842EC243EE13432921' })
  @IsOptional()
  @IsString()
  creatorAddress?: string;

  @ApiPropertyOptional({ example: '0x5FbDB2315678afecb367f032d93F642f64180aa3' })
  @IsOptional()
  @IsString()
  tokenAddress?: string;

  @ApiProperty({ enum: AllocationMode, example: AllocationMode.BIDDING })
  @IsEnum(AllocationMode)
  allocationMode: AllocationMode;

  @ApiProperty({ minimum: 5, maximum: 10, example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10)
  maxMembers: number;

  @ApiProperty({
    description: 'Contribution amount in base units (6 decimals, e.g. 100000000 = 100 mUSDC)',
    example: '100000000',
  })
  @IsString()
  contributionAmount: string;

  @ApiProperty({
    description: 'Collateral amount in base units (6 decimals, e.g. 100000000 = 100 mUSDC)',
    example: '100000000',
  })
  @IsString()
  collateralAmount: string;

  @ApiProperty({ example: 300 })
  @Type(() => Number)
  @IsInt()
  @Min(30)
  roundDurationSeconds: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  biddingDurationSeconds?: number;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(10)
  gracePeriodSeconds: number;

  @ApiPropertyOptional({
    description: 'Unix timestamp (seconds) or ISO string for recruitment deadline',
    example: '2026-11-10T00:00:00Z',
  })
  @IsOptional()
  startDeadline?: string | number;

  @ApiPropertyOptional({ example: '2000000' })
  @IsOptional()
  @IsString()
  minBid?: string;

  @ApiPropertyOptional({ example: '40000000' })
  @IsOptional()
  @IsString()
  maxBid?: string;
}

export class QueryCirclesDto {
  @ApiPropertyOptional({ enum: CircleStatus })
  @IsOptional()
  @IsEnum(CircleStatus)
  status?: CircleStatus;

  @ApiPropertyOptional({ enum: AllocationMode })
  @IsOptional()
  @IsEnum(AllocationMode)
  mode?: AllocationMode;

  @ApiPropertyOptional({
    description: 'Filter circles where this wallet address is a member or creator',
  })
  @IsOptional()
  @IsString()
  memberAddress?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

