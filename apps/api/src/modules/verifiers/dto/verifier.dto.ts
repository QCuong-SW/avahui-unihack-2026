import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class IssueAttestationDto {
  @ApiProperty({ example: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress: string;

  @ApiPropertyOptional({
    description: '32-byte identity nullifier hex; derived deterministically if omitted',
  })
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'identityNullifier must be a 32-byte hex string',
  })
  identityNullifier?: string;

  @ApiPropertyOptional({ default: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  trustTier?: number = 2;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dispatchOnChain?: boolean = true;
}

export class SignAttestationDto {
  @ApiProperty({ example: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  identityNullifier?: string;

  @ApiPropertyOptional({ default: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  trustTier?: number = 2;

  @ApiPropertyOptional({ default: 3600, minimum: 60, maximum: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  ttlSeconds?: number = 3600;
}

export class RevokeAttestationDto {
  @ApiProperty({ example: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  walletAddress: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dispatchOnChain?: boolean = true;
}

