import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ApiError } from './errors.js';

export type OrderLineInput = { productId: string; quantity: number };

type ProductRow = RowDataPacket & {
  id: string; name: string; active: number; unit_price_minor: string;
  stock_available: number;
};

type OrderRow = RowDataPacket & {
  id: string; status: 'reserved' | 'cancelled'; total_minor: string;
  currency: string; idempotency_key: string; request_fingerprint: string;
};

type ItemRow = RowDataPacket & {
  product_id: string; product_name_snapshot: string;
  unit_price_minor: string; quantity: number; line_total_minor: string;
};

function canonicalItems(items: OrderLineInput[]): OrderLineInput[] {
  return [...items].sort((a, b) => a.productId.localeCompare(b.productId));
}

function fingerprint(items: OrderLineInput[]): string {
  return createHash('sha256').update(JSON.stringify(canonicalItems(items))).digest('hex');
}

async function orderById(connection: Pool | PoolConnection, id: string) {
  const [rows] = await connection.query<OrderRow[]>(
    'SELECT id, status, total_minor, currency, idempotency_key, request_fingerprint FROM orders WHERE id = ?', [id],
  );
  const order = rows[0];
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
  const [items] = await connection.query<ItemRow[]>(
    'SELECT product_id, product_name_snapshot, unit_price_minor, quantity, line_total_minor FROM order_items WHERE order_id = ? ORDER BY product_id', [id],
  );
  return {
    id: order.id,
    status: order.status,
    currency: order.currency,
    totalMinor: Number(order.total_minor),
    items: items.map(item => ({
      productId: item.product_id,
      productName: item.product_name_snapshot,
      unitPriceMinor: Number(item.unit_price_minor),
      quantity: item.quantity,
      lineTotalMinor: Number(item.line_total_minor),
    })),
  };
}

export function createOrderService(pool: Pool) {
  return {
    async list() {
      const [rows] = await pool.query<OrderRow[]>('SELECT id FROM orders ORDER BY created_at DESC, id DESC');
      return Promise.all(rows.map(row => orderById(pool, row.id)));
    },

    get(id: string) { return orderById(pool, id); },

    async create(items: OrderLineInput[], key: string) {
      const sorted = canonicalItems(items);
      const hash = fingerprint(sorted);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [existing] = await connection.query<OrderRow[]>(
          'SELECT id, request_fingerprint FROM orders WHERE idempotency_key = ?', [key],
        );
        if (existing[0]) {
          if (existing[0].request_fingerprint !== hash) {
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different order');
          }
          const order = await orderById(connection, existing[0].id);
          await connection.commit();
          return { order, replayed: true };
        }

        const products: ProductRow[] = [];
        for (const item of sorted) {
          const [rows] = await connection.query<ProductRow[]>(
            'SELECT id, name, active, unit_price_minor, stock_available FROM products WHERE id = ? FOR UPDATE', [item.productId],
          );
          const product = rows[0];
          if (!product || !product.active) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found or inactive');
          if (product.stock_available < item.quantity) throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock');
          products.push(product);
        }

        const totalMinor = sorted.reduce((sum, item, index) => sum + Number(products[index].unit_price_minor) * item.quantity, 0);
        if (!Number.isSafeInteger(totalMinor)) throw new ApiError(400, 'INVALID_TOTAL', 'Order total is too large');
        const id = randomUUID();
        await connection.execute(
          "INSERT INTO orders (id, idempotency_key, request_fingerprint, status, total_minor, currency) VALUES (?, ?, ?, 'reserved', ?, 'USD')",
          [id, key, hash, totalMinor],
        );
        for (const [index, item] of sorted.entries()) {
          const product = products[index];
          const unitPrice = Number(product.unit_price_minor);
          await connection.execute(
            'UPDATE products SET stock_available = stock_available - ? WHERE id = ? AND stock_available >= ?',
            [item.quantity, item.productId, item.quantity],
          );
          await connection.execute(
            'INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price_minor, quantity, line_total_minor) VALUES (?, ?, ?, ?, ?, ?)',
            [id, item.productId, product.name, unitPrice, item.quantity, unitPrice * item.quantity],
          );
          await connection.execute(
            "INSERT INTO reservations (id, order_id, product_id, quantity, status) VALUES (?, ?, ?, ?, 'active')",
            [randomUUID(), id, item.productId, item.quantity],
          );
        }
        const order = await orderById(connection, id);
        await connection.commit();
        return { order, replayed: false };
      } catch (error) {
        await connection.rollback();
        // Two concurrent requests with the same key can race at the unique index.
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
          const [rows] = await pool.query<OrderRow[]>('SELECT id, request_fingerprint FROM orders WHERE idempotency_key = ?', [key]);
          if (rows[0]) {
            if (rows[0].request_fingerprint !== hash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key was used for a different order');
            return { order: await orderById(pool, rows[0].id), replayed: true };
          }
        }
        throw error;
      } finally {
        connection.release();
      }
    },

    async cancel(id: string) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<OrderRow[]>('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [id]);
        if (!rows[0]) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
        if (rows[0].status === 'reserved') {
          const [reservations] = await connection.query<(RowDataPacket & { product_id: string; quantity: number })[]>(
            "SELECT product_id, quantity FROM reservations WHERE order_id = ? AND status = 'active' ORDER BY product_id FOR UPDATE", [id],
          );
          for (const reservation of reservations) {
            await connection.execute('UPDATE products SET stock_available = stock_available + ? WHERE id = ?', [reservation.quantity, reservation.product_id]);
          }
          await connection.execute("UPDATE reservations SET status = 'released' WHERE order_id = ? AND status = 'active'", [id]);
          await connection.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [id]);
        }
        const order = await orderById(connection, id);
        await connection.commit();
        return order;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
