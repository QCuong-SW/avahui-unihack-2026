import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from '../services/transactions.service';
import { TrackTransactionDto } from '../dto/track-transaction.dto';
import { PrivyAuthGuard } from '../../../guards/privy-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/decorators/current-user.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(PrivyAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('track')
  @ApiOperation({
    summary:
      'Frontend báo cho Backend biết vừa gửi 1 txHash (trạng thái PENDING) để hiển thị ngay',
  })
  async track(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TrackTransactionDto,
  ) {
    return this.transactionsService.trackTransaction(user, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Lịch sử giao dịch của user hiện tại' })
  @ApiQuery({ name: 'circleId', required: false })
  async getMy(
    @CurrentUser() user: AuthenticatedUser,
    @Query('circleId') circleId?: string,
  ) {
    return this.transactionsService.getMyTransactions(user, circleId);
  }
}

