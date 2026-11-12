import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { OrderFlowResolver } from './orderflow.resolver.js';

@Module({
  imports: [ProductsModule, OrdersModule],
  providers: [OrderFlowResolver],
})
export class OrderFlowGraphqlModule {}
