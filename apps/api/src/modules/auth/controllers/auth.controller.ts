import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { SyncAuthDto } from '../dto/sync-auth.dto';
import { VerifySiweDto } from '../dto/siwe.dto';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('siwe/nonce')
  @ApiOperation({
    summary: 'Cấp nonce challenge ký thông điệp SIWE cho ví Core / MetaMask',
  })
  @ApiQuery({ name: 'address', required: true })
  async getSiweNonce(@Query('address') address: string) {
    return this.authService.requestSiweNonce(address);
  }

  @Post('siwe/verify')
  @ApiOperation({
    summary: 'Xác thực chữ ký SIWE (EIP-191) và cấp JWT phiên làm việc',
  })
  async verifySiwe(@Body() dto: VerifySiweDto) {
    return this.authService.verifySiweSignature(dto);
  }

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
