import { Injectable } from '@nestjs/common';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../api-error.js';

export type ProductRecord = RowDataPacket & {
  id: string;
  name: string;
  active: number;
  unit_price_minor: string;
  stock_available: number;
};

export type RequestedLine = { productId: string; quantity: number };

@Injectable()
export class InventoryService {
  async lockAvailableProducts(connection: PoolConnection, lines: RequestedLine[]) {
    const products: ProductRecord[] = [];
    for (const line of lines) {
      const [rows] = await connection.query<ProductRecord[]>(
        'SELECT id, name, active, unit_price_minor, stock_available FROM products WHERE id = ? FOR UPDATE',
        [line.productId],
      );
      const product = rows[0];
      if (!product || !product.active) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found or inactive');
      if (product.stock_available < line.quantity) throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock');
      products.push(product);
    }
    return products;
  }

  async reserve(connection: PoolConnection, line: RequestedLine) {
    await connection.execute(
      'UPDATE products SET stock_available = stock_available - ? WHERE id = ? AND stock_available >= ?',
      [line.quantity, line.productId, line.quantity],
    );
  }

  async release(connection: PoolConnection, productId: string, quantity: number) {
    await connection.execute(
      'UPDATE products SET stock_available = stock_available + ? WHERE id = ?',
      [quantity, productId],
    );
  }
}
