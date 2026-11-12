import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { HealthController } from './health.controller.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [DatabaseModule, ProductsModule, InventoryModule, OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}
