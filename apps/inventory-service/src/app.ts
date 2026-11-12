import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from './db.js';
import { ServiceError } from './errors.js';

type Line = { productId: string; quantity: number };
type ItemRow = RowDataPacket & { product_id: string; stock_available: number };
type OperationRow = RowDataPacket & { operation_type: string; request_fingerprint: string; resource_id: string };
type ReservationRow = RowDataPacket & { product_id: string; quantity: number; status: 'active' | 'released' };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonical = (lines: Line[]) => [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function requireOperationId(request: Request) {
  const operationId = request.header('Idempotency-Key');
  if (!operationId || !uuid.test(operationId)) throw new ServiceError(400, 'INVALID_OPERATION_ID', 'A UUID Idempotency-Key is required');
  return operationId;
}

function requireLines(value: unknown): Line[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new ServiceError(400, 'VALIDATION_ERROR', 'Invalid reservation lines');
  const lines = value as Line[];
  if (lines.some(line => !uuid.test(line?.productId) || !Number.isInteger(line?.quantity) || line.quantity < 1)) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Invalid reservation lines');
  }
  if (new Set(lines.map(line => line.productId)).size !== lines.length) throw new ServiceError(400, 'VALIDATION_ERROR', 'Duplicate products are not allowed');
  return canonical(lines);
}

async function existingOperation(connection: PoolConnection, operationId: string, type: string, hash: string) {
  const [rows] = await connection.query<OperationRow[]>(
    'SELECT operation_type, request_fingerprint, resource_id FROM inventory_operations WHERE operation_id = ? FOR UPDATE',
    [operationId],
  );
  const existing = rows[0];
  if (!existing) return undefined;
  if (existing.operation_type !== type || existing.request_fingerprint !== hash) {
    throw new ServiceError(409, 'IDEMPOTENCY_CONFLICT', 'Operation ID was used for a different request');
  }
  return existing;
}

async function reservation(orderId: string) {
  const [rows] = await pool.query<ReservationRow[]>(
    'SELECT product_id, quantity, status FROM inventory_reservations WHERE order_id = ? ORDER BY product_id', [orderId],
  );
  if (!rows.length) throw new ServiceError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
  return { orderId, status: rows.every(row => row.status === 'released') ? 'released' : 'active', items: rows.map(row => ({ productId: row.product_id, quantity: row.quantity })) };
}

export const app = express();
app.use(express.json({ limit: '16kb' }));

app.get('/health', async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok' });
});

app.post('/items', async (request, response) => {
  const operationId = requireOperationId(request);
  const { productId, stockAvailable } = request.body ?? {};
  if (!uuid.test(productId) || !Number.isInteger(stockAvailable) || stockAvailable < 0 || stockAvailable > 2_147_483_647) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Invalid inventory item');
  }
  const hash = fingerprint({ productId, stockAvailable });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await existingOperation(connection, operationId, 'register', hash);
    if (existing) {
      const [rows] = await connection.query<ItemRow[]>('SELECT product_id, stock_available FROM inventory_items WHERE product_id = ?', [productId]);
      await connection.commit();
      response.status(200).json({ productId: rows[0]!.product_id, stockAvailable: rows[0]!.stock_available, replayed: true });
      return;
    }
    await connection.execute('INSERT INTO inventory_items (product_id, stock_available) VALUES (?, ?)', [productId, stockAvailable]);
    await connection.execute(
      "INSERT INTO inventory_operations (operation_id, operation_type, request_fingerprint, resource_id) VALUES (?, 'register', ?, ?)",
      [operationId, hash, productId],
    );
    await connection.commit();
    response.status(201).json({ productId, stockAvailable, replayed: false });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
});

app.get('/items/:productId', async (request, response) => {
  const [rows] = await pool.query<ItemRow[]>('SELECT product_id, stock_available FROM inventory_items WHERE product_id = ?', [request.params.productId]);
  if (!rows[0]) throw new ServiceError(404, 'ITEM_NOT_FOUND', 'Inventory item not found');
  response.json({ productId: rows[0].product_id, stockAvailable: rows[0].stock_available });
});

app.post('/reservations', async (request, response) => {
  const operationId = requireOperationId(request);
  const orderId = request.body?.orderId;
  if (!uuid.test(orderId)) throw new ServiceError(400, 'VALIDATION_ERROR', 'Invalid order ID');
  const lines = requireLines(request.body?.items);
  const hash = fingerprint({ orderId, items: lines });
  const fault = request.header('X-Inventory-Fault');
  if (fault === 'unavailable') throw new ServiceError(503, 'INVENTORY_UNAVAILABLE', 'Inventory is unavailable');

  const connection = await pool.getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const existing = await existingOperation(connection, operationId, 'reserve', hash);
    if (existing) {
      await connection.commit();
      response.status(200).json({ ...(await reservation(orderId)), replayed: true });
      return;
    }
    for (const line of lines) {
      const [rows] = await connection.query<ItemRow[]>('SELECT product_id, stock_available FROM inventory_items WHERE product_id = ? FOR UPDATE', [line.productId]);
      if (!rows[0]) throw new ServiceError(404, 'ITEM_NOT_FOUND', 'Inventory item not found');
      if (rows[0].stock_available < line.quantity) throw new ServiceError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock');
    }
    for (const line of lines) {
      await connection.execute('UPDATE inventory_items SET stock_available = stock_available - ? WHERE product_id = ?', [line.quantity, line.productId]);
      await connection.execute(
        "INSERT INTO inventory_reservations (order_id, product_id, quantity, status) VALUES (?, ?, ?, 'active')",
        [orderId, line.productId, line.quantity],
      );
    }
    if (fault === 'fail-before-commit') throw new ServiceError(503, 'INJECTED_FAILURE', 'Injected failure before commit');
    await connection.execute(
      "INSERT INTO inventory_operations (operation_id, operation_type, request_fingerprint, resource_id) VALUES (?, 'reserve', ?, ?)",
      [operationId, hash, orderId],
    );
    await connection.commit();
    committed = true;
    if (fault === 'delay-after-commit') await new Promise(resolve => setTimeout(resolve, 250));
    response.status(201).json({ ...(await reservation(orderId)), replayed: false });
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally { connection.release(); }
});

app.get('/reservations/:orderId', async (request, response) => response.json(await reservation(request.params.orderId)));

app.post('/reservations/:orderId/release', async (request, response) => {
  const operationId = requireOperationId(request);
  const orderId = request.params.orderId;
  if (!uuid.test(orderId)) throw new ServiceError(400, 'VALIDATION_ERROR', 'Invalid order ID');
  const hash = fingerprint({ orderId });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await existingOperation(connection, operationId, 'release', hash);
    if (existing) {
      await connection.commit();
      response.json({ ...(await reservation(orderId)), replayed: true });
      return;
    }
    const [rows] = await connection.query<ReservationRow[]>(
      'SELECT product_id, quantity, status FROM inventory_reservations WHERE order_id = ? ORDER BY product_id FOR UPDATE', [orderId],
    );
    if (!rows.length) throw new ServiceError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
    for (const row of rows.filter(row => row.status === 'active')) {
      await connection.execute('UPDATE inventory_items SET stock_available = stock_available + ? WHERE product_id = ?', [row.quantity, row.product_id]);
    }
    await connection.execute("UPDATE inventory_reservations SET status = 'released' WHERE order_id = ? AND status = 'active'", [orderId]);
    await connection.execute(
      "INSERT INTO inventory_operations (operation_id, operation_type, request_fingerprint, resource_id) VALUES (?, 'release', ?, ?)",
      [operationId, hash, orderId],
    );
    await connection.commit();
    response.json({ ...(await reservation(orderId)), replayed: false });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ServiceError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error) {
    response.status(Number(error.status)).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    return;
  }
  console.error(error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
});
