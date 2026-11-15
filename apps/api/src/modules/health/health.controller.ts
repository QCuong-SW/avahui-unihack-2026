import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../database/prisma.service';
import { createFujiPublicClient } from '../../common/utils/rpc.util';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly rpcUrl =
    process.env.AVALANCHE_RPC_URL ||
    'https://avalanche-fuji-c-chain-rpc.publicnode.com';
  private readonly publicClient = createFujiPublicClient(this.rpcUrl, 2500);

  private cachedBlock: string | null = null;
  private cachedRpcStatus: 'up' | 'degraded' = 'up';
  private lastRpcCheckAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  @Get('ping')
  @ApiOperation({ summary: 'Ultra-fast keep-alive wakeup probe (<5ms)' })
  ping() {
    return {
      status: 'ok',
      awake: true,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Kiểm tra tình trạng API, PostgreSQL và kết nối Fuji RPC',
  })
  async checkHealth() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    const now = Date.now();
    if (now - this.lastRpcCheckAt > 20_000 || !this.cachedBlock) {
      this.lastRpcCheckAt = now;
      try {
        const block = await this.publicClient.getBlockNumber();
        this.cachedBlock = block.toString();
        this.cachedRpcStatus = 'up';
      } catch {
        this.cachedRpcStatus = 'degraded';
      }
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      chainId: Number(process.env.CHAIN_ID || 43113),
      services: {
        database,
        rpc: this.cachedRpcStatus,
        latestBlock: this.cachedBlock,
        indexerEnabled:
          String(process.env.INDEXER_ENABLED ?? 'true').toLowerCase() === 'true',
        keeperEnabled:
          String(process.env.KEEPER_ENABLED ?? 'true').toLowerCase() === 'true',
      },
    };
  }
}
