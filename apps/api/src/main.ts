import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('AvaHuiAPI');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        configuredOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
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

