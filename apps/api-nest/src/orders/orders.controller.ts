import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../api-error.js';
import { CreateOrderDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponse, OrderResponse } from '../api-docs.models.js';

@Controller('orders')
@ApiTags('orders')
@ApiTooManyRequestsResponse({ type: ErrorResponse })
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an order and reserve all requested stock atomically' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique key for one canonical order payload.', example: 'swagger-demo-001' })
  @ApiCreatedResponse({ type: OrderResponse, description: 'Order created.' })
  @ApiOkResponse({ type: OrderResponse, description: 'Matching idempotent replay.' })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiConflictResponse({ type: ErrorResponse })
  async create(
    @Body() input: CreateOrderDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res() response: Response,
  ) {
    if (!key || key.length > 120 || !/^[\w.-]+$/.test(key)) {
      throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required');
    }
    const result = await this.orders.create(input.items, key);
    response.status(result.replayed ? 200 : 201).json(result.order);
  }

  @Get()
  @ApiOperation({ summary: 'List committed orders' })
  @ApiOkResponse({ type: OrderResponse, isArray: true })
  list() { return this.orders.list(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get one committed order' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  get(@Param('id', new ParseUUIDPipe()) id: string) { return this.orders.get(id); }

  @Post(':id/cancel') @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cancel an order and release stock once' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  cancel(@Param('id', new ParseUUIDPipe()) id: string) { return this.orders.cancel(id); }
}
