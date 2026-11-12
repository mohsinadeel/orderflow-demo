import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { AppModule } from './app.module.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
const basePath = (process.env.ORDERFLOW_BASE_PATH ?? '').trim().replace(/\/+$/, '');
if (basePath && !/^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(basePath)) {
  throw new Error('ORDERFLOW_BASE_PATH must be an absolute URL path without query parameters');
}
if (basePath) {
  app.use((request: Request, _response: Response, next: NextFunction) => {
    if (request.url === basePath) request.url = '/';
    else if (request.url.startsWith(`${basePath}/`)) request.url = request.url.slice(basePath.length);
    next();
  });
}
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
  throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5');
}
if (trustProxyHops) app.set('trust proxy', trustProxyHops);
app.useBodyParser('json', { limit: '32kb' });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new ApiExceptionFilter());
const publicApiUrl = process.env.ORDERFLOW_PUBLIC_API_URL;
const documentBuilder = new DocumentBuilder()
  .setTitle('OrderFlow REST API')
  .setDescription('Interactive contract for the synthetic OrderFlow reservation demo. Mutations change temporary local demo data.')
  .setVersion('unreleased');
if (publicApiUrl) documentBuilder.addServer(publicApiUrl);
const openApi = SwaggerModule.createDocument(app, documentBuilder.build());
SwaggerModule.setup('api/docs', app, openApi, {
  jsonDocumentUrl: 'api/openapi.json',
  customSiteTitle: 'OrderFlow REST API',
});
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
