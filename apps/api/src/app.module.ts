import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';
import { WalletsModule } from './modules/wallets/wallets.module';

const rawThrottleTtl = Number(process.env.THROTTLE_TTL || 60000);
const normalizedThrottleTtl =
  rawThrottleTtl > 0 && rawThrottleTtl < 1000 ? rawThrottleTtl * 1000 : rawThrottleTtl;
const throttleLimit = Number(process.env.THROTTLE_LIMIT || 100);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: normalizedThrottleTtl,
        limit: throttleLimit,
      },
    ]),
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
    HealthModule,
    AiModule,
    WalletsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
