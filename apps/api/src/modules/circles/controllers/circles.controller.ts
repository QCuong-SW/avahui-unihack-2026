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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CirclesService } from '../services/circles.service';
import { CreateCircleDraftDto, QueryCirclesDto } from '../dto/circle.dto';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import { OptionalAuthGuard } from '../../../guards/optional-auth.guard';
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
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary:
      'Danh sách dây hụi (filter theo status, mode, memberAddress, phân trang; tự lọc dây riêng tư)',
  })
  async listCircles(
    @Query() query: QueryCirclesDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.circlesService.listCircles(query, user);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary:
      'Chi tiết đầy đủ 1 dây hụi (hỗ trợ tìm theo UUID id, metadataId hoặc contractAddress; kiểm tra quyền dây riêng tư)',
  })
  @ApiQuery({ name: 'inviteCode', required: false })
  async getCircle(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Query('inviteCode') inviteCode?: string,
  ) {
    return this.circlesService.getCircleById(id, user, inviteCode);
  }

  @Get(':id/rounds/:roundNumber')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: 'Chi tiết đóng góp & đấu giá của 1 vòng cụ thể trong dây hụi',
  })
  @ApiQuery({ name: 'inviteCode', required: false })
  async getRound(
    @Param('id') id: string,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @CurrentUser() user?: AuthenticatedUser,
    @Query('inviteCode') inviteCode?: string,
  ) {
    return this.circlesService.getRoundDetail(id, roundNumber, user, inviteCode);
  }
}
