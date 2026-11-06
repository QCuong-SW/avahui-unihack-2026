import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class SyncAuthDto {
  @ApiProperty({
    description: 'Privy Embedded Wallet Address',
    example: '0x71C95911E9a5D330f4D621842EC243EE13432921',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress: string;

  @ApiPropertyOptional({ example: 'builder@avahui.io' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Minh Nguyễn (UniHack Builder)' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'did:privy:usr_01HXYZ1' })
  @IsOptional()
  @IsString()
  privyDid?: string;
}

