import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { SecurityModule } from './guards/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CirclesModule } from './modules/circles/circles.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { AdminModule } from './modules/admin/admin.module';
import { VerifiersModule } from './modules/verifiers/verifiers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    CirclesModule,
    TransactionsModule,
    NotificationsModule,
    BlockchainModule,
    AdminModule,
    VerifiersModule,
  ],
})
export class AppModule {}
