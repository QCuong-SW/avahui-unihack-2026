import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CirclesService } from '../services/circles.service';
import { CreateCircleDraftDto, QueryCirclesDto } from '../dto/circle.dto';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';

@ApiTags('Circles')
@Controller('circles')
export class CirclesController {
  constructor(private readonly circlesService: CirclesService) {}

  @Post('draft')
  @UseGuards(PrivyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Tạo bản ghi nháp (lưu mô tả chi tiết, trả về metadataId để truyền vào hàm createCircle trên SC)',
  })
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCircleDraftDto,
  ) {
    return this.circlesService.createDraft(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách dây hụi (filter theo status, mode, memberAddress, phân trang)',
  })
  async listCircles(@Query() query: QueryCirclesDto) {
    return this.circlesService.listCircles(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Chi tiết đầy đủ 1 dây hụi (hỗ trợ tìm theo UUID id, metadataId hoặc contractAddress)',
  })
  async getCircle(@Param('id') id: string) {
    return this.circlesService.getCircleById(id);
  }

  @Get(':id/rounds/:roundNumber')
  @ApiOperation({
    summary: 'Chi tiết đóng góp & đấu giá của 1 vòng cụ thể trong dây hụi',
  })
  async getRound(
    @Param('id') id: string,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
  ) {
    return this.circlesService.getRoundDetail(id, roundNumber);
  }

  @Post(':id/invites')
  @UseGuards(PrivyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo vé mời chữ ký số (EIP-712 Invite Voucher) dùng một lần cho dây hụi riêng tư (V2)',
  })
  async createInviteVoucher(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { invitee?: string; expiresInSeconds?: number },
  ) {
    return this.circlesService.createInviteVoucher(id, user, body);
  }

  @Post(':id/invites/verify')
  @ApiOperation({
    summary: 'Xác minh vé mời chữ ký số (EIP-712 Invite Voucher) trước khi tham gia (V2)',
  })
  async verifyInviteVoucher(
    @Param('id') id: string,
    @Body()
    body: {
      invitee?: string;
      nonce: number | string;
      expiresAt: number | string;
      voucherHash: string;
    },
  ) {
    return this.circlesService.verifyInviteVoucher(id, body);
  }
}

