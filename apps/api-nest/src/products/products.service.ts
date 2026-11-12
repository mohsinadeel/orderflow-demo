import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../api-error.js';
import { DATABASE_POOL } from '../database.module.js';
import type { CreateProductDto, UpdateProductDto } from './products.dto.js';

type ProductRow = RowDataPacket & { id: string; name: string; active: number; unit_price_minor: string; stock_available: number };

function present(row: ProductRow) {
  return {
    id: row.id, name: row.name, active: Boolean(row.active),
    unitPriceMinor: Number(row.unit_price_minor), currency: 'USD', stockAvailable: row.stock_available,
  };
}

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateProductDto) {
    const id = randomUUID();
    const name = input.name.trim();
    if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request');
    await this.pool.execute(
      'INSERT INTO products (id, name, unit_price_minor, stock_available) VALUES (?, ?, ?, ?)',
      [id, name, input.unitPriceMinor, input.stockAvailable],
    );
    return { id, name, unitPriceMinor: input.unitPriceMinor, stockAvailable: input.stockAvailable, active: true, currency: 'USD' };
  }

  async list() {
    const [rows] = await this.pool.query<ProductRow[]>(
      'SELECT id, name, active, unit_price_minor, stock_available FROM products ORDER BY name, id',
    );
    return rows.map(present);
  }

  async update(id: string, patch: UpdateProductDto) {
    const [result] = await this.pool.execute<import('mysql2').ResultSetHeader>(
      'UPDATE products SET unit_price_minor = COALESCE(?, unit_price_minor), active = COALESCE(?, active) WHERE id = ?',
      [patch.unitPriceMinor ?? null, patch.active === undefined ? null : Number(patch.active), id],
    );
    if (!result.affectedRows) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    const [rows] = await this.pool.query<ProductRow[]>(
      'SELECT id, name, active, unit_price_minor, stock_available FROM products WHERE id = ?', [id],
    );
    return present(rows[0]!);
  }
}
