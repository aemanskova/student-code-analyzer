import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RequestAbortedFilter } from './common/filters/request-aborted.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new RequestAbortedFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Code Analysis API')
    .setDescription('API для анализа студенческих работ')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const server = await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
  const requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 0);
  if (Number.isFinite(requestTimeout) && requestTimeout >= 0) {
    server.requestTimeout = requestTimeout;
  }
}

bootstrap();
