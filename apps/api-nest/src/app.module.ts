import { Module } from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { DatabaseModule } from './database.module.js';
import { OrderFlowGraphqlModule } from './graphql/orderflow-graphql.module.js';
import { HealthController } from './health.controller.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      graphiql: true,
    }),
    DatabaseModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    OrderFlowGraphqlModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
