import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { WalletsService } from '../services/wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(PrivyAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('faucet-gas/status')
  @ApiOperation({
    summary: 'Kiểm tra điều kiện nhận AVAX phí gas testnet cho ví nhúng Privy mới',
  })
  async getGasFaucetStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.walletsService.getGasFaucetStatus(user);
  }

  @Post('faucet-gas')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Cấp 0.02 AVAX Fuji miễn phí cho ví người dùng mới (< 0.015 AVAX, cooldown 24h)',
  })
  async dripGas(@CurrentUser() user: AuthenticatedUser) {
    return this.walletsService.dripTestnetGas(user);
  }
}

