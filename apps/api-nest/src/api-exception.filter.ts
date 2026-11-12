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
        const code = status === HttpStatus.NOT_FOUND ? 'NOT_FOUND'
          : status === HttpStatus.PAYLOAD_TOO_LARGE ? 'PAYLOAD_TOO_LARGE'
            : status === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMITED' : 'VALIDATION_ERROR';
        const message = status === HttpStatus.NOT_FOUND ? 'Not found'
          : status === HttpStatus.PAYLOAD_TOO_LARGE ? 'Request payload is too large'
            : status === HttpStatus.TOO_MANY_REQUESTS ? 'Rate limit exceeded' : 'Invalid request';
        return new GraphQLError(message, {
          extensions: {
            code,
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
      const code = status === HttpStatus.NOT_FOUND ? 'NOT_FOUND'
        : status === HttpStatus.PAYLOAD_TOO_LARGE ? 'PAYLOAD_TOO_LARGE'
          : status === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMITED' : 'VALIDATION_ERROR';
      const message = status === HttpStatus.NOT_FOUND ? 'Not found'
        : status === HttpStatus.PAYLOAD_TOO_LARGE ? 'Request payload is too large'
          : status === HttpStatus.TOO_MANY_REQUESTS ? 'Rate limit exceeded' : 'Invalid request';
      response.status(status).json({
        error: { code, message },
      });
      return;
    }
    this.logger.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}
