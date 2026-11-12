import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';
import { ApiError } from './api-error.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    if (host.getType<string>() === 'graphql') {
      if (error instanceof ApiError) {
        return new GraphQLError(error.message, {
          extensions: { code: error.code, status: error.status },
        });
      }
      if (error instanceof HttpException) {
        const status = error.getStatus();
        return new GraphQLError(status === HttpStatus.NOT_FOUND ? 'Not found' : 'Invalid request', {
          extensions: {
            code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'VALIDATION_ERROR',
            status,
          },
        });
      }
      this.logger.error(error);
      return new GraphQLError('Unexpected error', {
        extensions: { code: 'INTERNAL_ERROR', status: 500 },
      });
    }
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof HttpException) {
      const status = error.getStatus();
      response.status(status).json({
        error: {
          code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'VALIDATION_ERROR',
          message: status === HttpStatus.NOT_FOUND ? 'Not found' : 'Invalid request',
        },
      });
      return;
    }
    this.logger.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}
