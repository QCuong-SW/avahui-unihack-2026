import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Minh Nguyễn (UniHack Builder)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ example: 'https://avatar.vercel.sh/avahui.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

