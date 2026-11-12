import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../api-error.js';
import { CreateOrderDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
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

  @Get() list() { return this.orders.list(); }
  @Get(':id') get(@Param('id', new ParseUUIDPipe()) id: string) { return this.orders.get(id); }
  @Post(':id/cancel') @HttpCode(200)
  cancel(@Param('id', new ParseUUIDPipe()) id: string) { return this.orders.cancel(id); }
}
