import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import {
  isAllowedCorsOrigin,
  parseCorsOrigins,
} from './common/utils/cors.util';

async function bootstrap() {
  const logger = new Logger('AvaHuiAPI');
  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';
  const trustProxyFlag = String(process.env.TRUST_PROXY ?? '').toLowerCase();
  if (
    trustProxyFlag === 'true' ||
    (trustProxyFlag !== 'false' && isProduction)
  ) {
    // Behind reverse proxies (Cloudflare/Railway/Render/Nginx) so throttler uses X-Forwarded-For
    const expressInstance = app.getHttpAdapter().getInstance();
    if (typeof expressInstance?.set === 'function') {
      expressInstance.set('trust proxy', 1);
    }
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

  app.enableCors({
    origin: (origin, callback) => {
      callback(
        null,
        isAllowedCorsOrigin(origin, configuredOrigins, isProduction),
      );
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AvaHui API — On-Chain ROSCA Platform on Avalanche')
    .setDescription(
      'REST API & Blockchain Event Indexer for AvaHui (Avalanche UniHack 2026). All endpoints use `/api/v1` prefix.',
    )
    .setVersion('2.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  logger.log(`AvaHui Backend API running on http://localhost:${port}/api/v1`);
  logger.log(`Swagger UI available at http://localhost:${port}/api/docs`);
}

bootstrap();

