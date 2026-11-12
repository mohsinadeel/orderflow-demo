import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { DatabaseModule } from './database.module.js';
import { OrderFlowGraphqlModule } from './graphql/orderflow-graphql.module.js';
import { HealthController } from './health.controller.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';
import { OrderFlowThrottlerGuard } from './orderflow-throttler.guard.js';
import type { Request, Response } from 'express';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      graphiql: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: seconds(60), limit: 600 }]),
    DatabaseModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    OrderFlowGraphqlModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: OrderFlowThrottlerGuard }],
})
export class AppModule {}
