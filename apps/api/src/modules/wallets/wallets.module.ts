import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WalletsController } from './controllers/wallets.controller';
import { WalletsService } from './services/wallets.service';

@Module({
  imports: [UsersModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}

