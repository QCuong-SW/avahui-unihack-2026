import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@avahui/shared';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { VerifiersService } from '../services/verifiers.service';
import {
  IssueAttestationDto,
  RevokeAttestationDto,
  SignAttestationDto,
} from '../dto/verifier.dto';

@ApiTags('Verifiers')
@ApiBearerAuth()
@Controller('verifiers')
@UseGuards(PrivyAuthGuard, RolesGuard)
export class VerifiersController {
  constructor(private readonly verifiersService: VerifiersService) {}

  @Get('attestations/me')
  @ApiOperation({ summary: 'Xem trạng thái chứng nhận Team1 Anti-Sybil của bản thân' })
  async getMyStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.verifiersService.getMyAttestationStatus(user);
  }

  @Post('attestations/issue')
  @Roles(UserRole.VERIFIER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cấp chứng nhận Team1 Anti-Sybil trực tiếp lên on-chain & DB (VERIFIER/ADMIN)',
  })
  async issueAttestation(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: IssueAttestationDto,
  ) {
    return this.verifiersService.issueAttestation(actor, dto);
  }

  @Post('attestations/sign')
  @Roles(UserRole.VERIFIER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Ký voucher EIP-712 cho user tự claimAttestationWithSignature (VERIFIER/ADMIN)',
  })
  async signAttestation(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SignAttestationDto,
  ) {
    return this.verifiersService.signAttestationVoucher(actor, dto);
  }

  @Post('attestations/revoke')
  @Roles(UserRole.VERIFIER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Thu hồi chứng nhận Team1 Anti-Sybil (VERIFIER/ADMIN)',
  })
  async revokeAttestation(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RevokeAttestationDto,
  ) {
    return this.verifiersService.revokeAttestation(actor, dto);
  }
}

