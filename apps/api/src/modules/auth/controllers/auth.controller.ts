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

  @Post('attestation')
  @UseGuards(PrivyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Cấp chứng thực định danh chống Sybil (Team1 Attestation Verifier) cho địa chỉ ví (V2)',
  })
  async issueAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { walletAddress?: string; email?: string },
  ) {
    return this.authService.issueTeam1Attestation(user, body);
  }

  @Post('faucet-check')
  @UseGuards(PrivyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Kiểm tra giới hạn tần suất (Rate-Limit Cooldown) trước khi nhận mUSDC Faucet (V2)',
  })
  async checkFaucetCooldown(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { walletAddress?: string },
  ) {
    return this.authService.checkAndRecordFaucetClaim(user, body?.walletAddress);
  }
}

