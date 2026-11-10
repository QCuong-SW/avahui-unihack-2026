import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@avahui/shared';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { AdminService } from '../services/admin.service';
import {
  ModerateCircleDto,
  QueryAdminUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from '../dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PrivyAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Thống kê toàn hệ thống (chỉ ADMIN)' })
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Danh sách người dùng & phân quyền (chỉ ADMIN)' })
  async listUsers(@Query() query: QueryAdminUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Cập nhật role của người dùng (MEMBER/VERIFIER/ADMIN)' })
  async updateUserRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(actor, id, dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Khóa hoặc mở khóa tài khoản người dùng' })
  async updateUserStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(actor, id, dto);
  }

  @Get('circles')
  @ApiOperation({ summary: 'Danh sách tất cả dây hụi phục vụ kiểm duyệt (kể cả ẩn/riêng tư)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listCircles(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.adminService.listCircles(page, limit);
  }

  @Patch('circles/:id/moderation')
  @ApiOperation({ summary: 'Ẩn/hiện dây hụi vi phạm khỏi danh sách công khai' })
  async moderateCircle(
    @Param('id') id: string,
    @Body() dto: ModerateCircleDto,
  ) {
    return this.adminService.moderateCircle(id, dto);
  }
}

