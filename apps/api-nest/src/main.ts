import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new ApiExceptionFilter());
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
