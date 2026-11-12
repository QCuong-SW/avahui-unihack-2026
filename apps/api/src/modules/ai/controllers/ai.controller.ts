import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../../../guards/optional-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';
import { AiService } from '../services/ai.service';

@ApiTags('AI Advisor')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('circles/:id/advisor')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: 'Phân tích rủi ro dây hụi, dự phóng Yield & gợi ý giá đấu (AI Advisor)',
  })
  @ApiQuery({ name: 'inviteCode', required: false })
  async getCircleAdvisor(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Query('inviteCode') inviteCode?: string,
  ) {
    return this.aiService.getCircleAdvisor(id, user, inviteCode);
  }
}

