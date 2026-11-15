import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * KeepAliveService
 * Continuously warms PostgreSQL (Neon auto-suspend prevention) and sends
 * outbound HTTP heartbeats through the public Render URL so the free-tier
 * container and database never spin down due to inactivity.
 */
@Injectable()
export class KeepAliveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeepAliveService.name);
  private timer: NodeJS.Timeout | null = null;

  // Default 3 minutes (180s) — well below Neon's 5m suspend & Render's 15m spin-down
  private readonly intervalMs = Number(
    process.env.KEEP_ALIVE_INTERVAL_MS || 180_000,
  );

  private readonly externalBaseUrl = (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_API_URL ||
    'https://avahui-api.onrender.com'
  ).replace(/\/+$/, '');

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const enabled =
      String(process.env.KEEP_ALIVE_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.log('KeepAliveService disabled via KEEP_ALIVE_ENABLED=false');
      return;
    }

    this.logger.log(
      `KeepAliveService active: pinging ${this.externalBaseUrl}/api/v1/health every ${Math.round(this.intervalMs / 1000)}s`,
    );

    // Initial warmup after 10s
    setTimeout(() => {
      this.pulse().catch(() => {});
    }, 10_000);

    this.timer = setInterval(() => {
      this.pulse().catch(() => {});
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pulse(): Promise<void> {
    // 1. Keep Neon PostgreSQL connection hot
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (dbErr) {
      this.logger.warn(
        `[KeepAlive] DB warmup ping failed: ${(dbErr as Error).message}`,
      );
    }

    // 2. Ping external Render ingress URL so edge proxy resets 15-min inactivity timer
    const targetUrl = this.externalBaseUrl.endsWith('/api/v1')
      ? `${this.externalBaseUrl}/health/ping`
      : `${this.externalBaseUrl}/api/v1/health/ping`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'AvaHui-SelfKeepAlive/2.1',
          'Cache-Control': 'no-cache, no-store',
        },
        signal: controller.signal,
      });
    } catch {
      // Ignore self-ping network errors in purely local offline environments
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
