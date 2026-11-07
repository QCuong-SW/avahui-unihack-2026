import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(PrivyAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Lấy hồ sơ user hiện tại, danh sách ví và 4 chỉ số thống kê Dashboard',
  })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUserProfile(user);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Cập nhật tên hiển thị (displayName) và avatarUrl của user hiện tại',
  })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateCurrentUser(user, dto);
  }
}

