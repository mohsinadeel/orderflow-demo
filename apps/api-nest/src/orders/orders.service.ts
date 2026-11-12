import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../api-error.js';
import { DATABASE_POOL } from '../database.module.js';
import { InventoryService, type RequestedLine } from '../inventory/inventory.service.js';
import { TABLES } from '../table-names.js';

type OrderRow = RowDataPacket & {
  id: string; status: 'reserved' | 'cancelled'; total_minor: string;
  currency: string; request_fingerprint: string;
};
type ItemRow = RowDataPacket & {
  product_id: string; product_name_snapshot: string; unit_price_minor: string;
  quantity: number; line_total_minor: string;
};

function canonical(lines: RequestedLine[]) {
  return [...lines].sort((left, right) => left.productId.localeCompare(right.productId));
}

function requestFingerprint(lines: RequestedLine[]) {
  return createHash('sha256').update(JSON.stringify(canonical(lines))).digest('hex');
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly inventory: InventoryService,
  ) {}

  private async present(connection: Pool | PoolConnection, id: string) {
    const [rows] = await connection.query<OrderRow[]>(
      `SELECT id, status, total_minor, currency, request_fingerprint FROM ${TABLES.orders} WHERE id = ?`, [id],
    );
    const order = rows[0];
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const [items] = await connection.query<ItemRow[]>(
      `SELECT product_id, product_name_snapshot, unit_price_minor, quantity, line_total_minor FROM ${TABLES.orderItems} WHERE order_id = ? ORDER BY product_id`,
      [id],
    );
    return {
      id: order.id, status: order.status, currency: order.currency, totalMinor: Number(order.total_minor),
      items: items.map(item => ({
        productId: item.product_id, productName: item.product_name_snapshot,
        unitPriceMinor: Number(item.unit_price_minor), quantity: item.quantity,
        lineTotalMinor: Number(item.line_total_minor),
      })),
    };
  }

  async list() {
    const [rows] = await this.pool.query<OrderRow[]>(`SELECT id FROM ${TABLES.orders} ORDER BY created_at DESC, id DESC`);
    return Promise.all(rows.map(row => this.present(this.pool, row.id)));
  }

  get(id: string) { return this.present(this.pool, id); }

  async create(lines: RequestedLine[], key: string) {
    if (new Set(lines.map(line => line.productId)).size !== lines.length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request');
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.createAttempt(lines, key);
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
        if ((code !== 'ER_LOCK_DEADLOCK' && code !== 'ER_LOCK_WAIT_TIMEOUT') || attempt === 2) throw error;
      }
    }
    throw new Error('Order transaction retry budget exhausted');
  }

  private async createAttempt(lines: RequestedLine[], key: string) {
    const sorted = canonical(lines);
    const fingerprint = requestFingerprint(sorted);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<OrderRow[]>(
        `SELECT id, request_fingerprint FROM ${TABLES.orders} WHERE idempotency_key = ?`, [key],
      );
      if (existing[0]) {
        if (existing[0].request_fingerprint !== fingerprint) {
          throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different order');
        }
        const order = await this.present(connection, existing[0].id);
        await connection.commit();
        return { order, replayed: true };
      }

      const products = await this.inventory.lockAvailableProducts(connection, sorted);
      const totalMinor = sorted.reduce(
        (sum, line, index) => sum + Number(products[index]!.unit_price_minor) * line.quantity, 0,
      );
      if (!Number.isSafeInteger(totalMinor)) throw new ApiError(400, 'INVALID_TOTAL', 'Order total is too large');
      const id = randomUUID();
      await connection.execute(
        `INSERT INTO ${TABLES.orders} (id, idempotency_key, request_fingerprint, status, total_minor, currency) VALUES (?, ?, ?, 'reserved', ?, 'USD')`,
        [id, key, fingerprint, totalMinor],
      );
      for (const [index, line] of sorted.entries()) {
        const product = products[index]!;
        const unitPrice = Number(product.unit_price_minor);
        await this.inventory.reserve(connection, line);
        await connection.execute(
          `INSERT INTO ${TABLES.orderItems} (order_id, product_id, product_name_snapshot, unit_price_minor, quantity, line_total_minor) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, line.productId, product.name, unitPrice, line.quantity, unitPrice * line.quantity],
        );
        await connection.execute(
          `INSERT INTO ${TABLES.reservations} (id, order_id, product_id, quantity, status) VALUES (?, ?, ?, ?, 'active')`,
          [randomUUID(), id, line.productId, line.quantity],
        );
      }
      const order = await this.present(connection, id);
      await connection.commit();
      return { order, replayed: false };
    } catch (error) {
      await connection.rollback();
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        const [rows] = await this.pool.query<OrderRow[]>(
          `SELECT id, request_fingerprint FROM ${TABLES.orders} WHERE idempotency_key = ?`, [key],
        );
        if (rows[0]) {
          if (rows[0].request_fingerprint !== fingerprint) {
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different order');
          }
          return { order: await this.present(this.pool, rows[0].id), replayed: true };
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async cancel(id: string) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<OrderRow[]>(`SELECT id, status FROM ${TABLES.orders} WHERE id = ? FOR UPDATE`, [id]);
      if (!rows[0]) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
      if (rows[0].status === 'reserved') {
        const [reservations] = await connection.query<(RowDataPacket & { product_id: string; quantity: number })[]>(
          `SELECT product_id, quantity FROM ${TABLES.reservations} WHERE order_id = ? AND status = 'active' ORDER BY product_id FOR UPDATE`,
          [id],
        );
        for (const reservation of reservations) {
          await this.inventory.release(connection, reservation.product_id, reservation.quantity);
        }
        await connection.execute(`UPDATE ${TABLES.reservations} SET status = 'released' WHERE order_id = ? AND status = 'active'`, [id]);
        await connection.execute(`UPDATE ${TABLES.orders} SET status = 'cancelled' WHERE id = ?`, [id]);
      }
      const order = await this.present(connection, id);
      await connection.commit();
      return order;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
