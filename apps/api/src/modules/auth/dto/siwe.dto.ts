import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class VerifySiweDto {
  @ApiProperty({
    description: 'EVM Wallet Address signing the SIWE challenge',
    example: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'address must be a valid Ethereum address',
  })
  address: string;

  @ApiProperty({ description: 'Exact SIWE challenge message signed by wallet' })
  @IsString()
  @MinLength(20)
  message: string;

  @ApiProperty({
    description: 'EIP-191 personal_sign signature hex string',
    example: '0x...',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{130}$/, {
    message: 'signature must be a valid 65-byte hex signature',
  })
  signature: string;

  @ApiPropertyOptional({ description: 'Optional explicit nonce (extracted from message if omitted)' })
  @IsOptional()
  @IsString()
  nonce?: string;
}

