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
    process.env.AVALANCHE_RPC_URL || 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
  private readonly publicClient = createFujiPublicClient(this.rpcUrl, 2500);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra tình trạng API, PostgreSQL và kết nối Fuji RPC' })
  async checkHealth() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    let rpc: 'up' | 'degraded' = 'degraded';
    let latestBlock: string | null = null;
    try {
      const block = await this.publicClient.getBlockNumber();
      latestBlock = block.toString();
      rpc = 'up';
    } catch {
      rpc = 'degraded';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      chainId: Number(process.env.CHAIN_ID || 43113),
      services: {
        database,
        rpc,
        latestBlock,
        indexerEnabled:
          String(process.env.INDEXER_ENABLED ?? 'true').toLowerCase() === 'true',
        keeperEnabled:
          String(process.env.KEEPER_ENABLED ?? 'true').toLowerCase() === 'true',
      },
    };
  }
}

