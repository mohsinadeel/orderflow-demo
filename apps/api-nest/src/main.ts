import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useBodyParser('json', { limit: '32kb' });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new ApiExceptionFilter());
const openApi = SwaggerModule.createDocument(app, new DocumentBuilder()
  .setTitle('OrderFlow REST API')
  .setDescription('Interactive contract for the synthetic OrderFlow reservation demo. Mutations change temporary local demo data.')
  .setVersion('unreleased')
  .build());
SwaggerModule.setup('api/docs', app, openApi, {
  jsonDocumentUrl: 'api/openapi.json',
  customSiteTitle: 'OrderFlow REST API',
});
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
