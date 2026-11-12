import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiError } from '../api-error.js';
import { OrdersService } from '../orders/orders.service.js';
import { ProductsService } from '../products/products.service.js';
import { CreateOrderInput, CreateProductInput, OrderType, ProductType, UpdateProductInput } from './orderflow-graphql.types.js';

@Resolver()
export class OrderFlowResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Query(() => [ProductType])
  products() { return this.productsService.list(); }

  @Query(() => [OrderType])
  orders() { return this.ordersService.list(); }

  @Query(() => OrderType)
  order(@Args('id', { type: () => ID }, new ParseUUIDPipe()) id: string) {
    return this.ordersService.get(id);
  }

  @Mutation(() => ProductType)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  createProduct(@Args('input') input: CreateProductInput) {
    return this.productsService.create(input);
  }

  @Mutation(() => ProductType)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  updateProduct(
    @Args('id', { type: () => ID }, new ParseUUIDPipe()) id: string,
    @Args('input') input: UpdateProductInput,
  ) {
    if (input.unitPriceMinor === undefined && input.active === undefined) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request');
    }
    return this.productsService.update(id, input);
  }

  @Mutation(() => OrderType)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async createOrder(@Args('input') input: CreateOrderInput) {
    if (!/^[\w.-]+$/.test(input.idempotencyKey)) {
      throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid idempotency key is required');
    }
    return (await this.ordersService.create(input.items, input.idempotencyKey)).order;
  }

  @Mutation(() => OrderType)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  cancelOrder(@Args('id', { type: () => ID }, new ParseUUIDPipe()) id: string) {
    return this.ordersService.cancel(id);
  }
}
