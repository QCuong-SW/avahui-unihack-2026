import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { SyncAuthDto } from '../dto/sync-auth.dto';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @UseGuards(PrivyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đồng bộ user từ Privy & liên kết địa chỉ Embedded Wallet vào DB',
  })
  async sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncAuthDto) {
    return this.authService.syncUser(user, dto);
  }
}

