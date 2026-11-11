import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z, ZodError } from 'zod';
import { ApiError } from './errors.js';
import { createOrderService } from './orders.js';

const productInput = z.object({
  name: z.string().trim().min(1).max(160),
  unitPriceMinor: z.number().int().positive().safe(),
  stockAvailable: z.number().int().min(0).max(2_147_483_647),
}).strict();

const productPatch = z.object({
  unitPriceMinor: z.number().int().positive().safe().optional(),
  active: z.boolean().optional(),
}).strict().refine(data => data.unitPriceMinor !== undefined || data.active !== undefined);

const orderInput = z.object({
  items: z.array(z.object({
    productId: z.uuid(),
    quantity: z.number().int().positive().max(2_147_483_647),
  }).strict()).min(1).max(50),
}).strict().refine(
  data => new Set(data.items.map(item => item.productId)).size === data.items.length,
  'Each product may appear only once',
);

const idSchema = z.uuid();

export function createApp(pool: Pool) {
  const app = express();
  const orders = createOrderService(pool);
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', async (_request, response, next) => {
    try {
      await pool.query('SELECT 1');
      response.json({ status: 'ok' });
    } catch (error) { next(error); }
  });

  app.post('/products', async (request, response, next) => {
    try {
      const product = productInput.parse(request.body);
      const id = randomUUID();
      await pool.execute(
        'INSERT INTO products (id, name, unit_price_minor, stock_available) VALUES (?, ?, ?, ?)',
        [id, product.name, product.unitPriceMinor, product.stockAvailable],
      );
      response.status(201).json({ id, ...product, active: true, currency: 'USD' });
    } catch (error) { next(error); }
  });

  app.get('/products', async (_request, response, next) => {
    try {
      const [rows] = await pool.query<(RowDataPacket & {
        id: string; name: string; active: number; unit_price_minor: string; stock_available: number;
      })[]>('SELECT id, name, active, unit_price_minor, stock_available FROM products ORDER BY name, id');
      response.json(rows.map(row => ({
        id: row.id, name: row.name, active: Boolean(row.active),
        unitPriceMinor: Number(row.unit_price_minor), currency: 'USD', stockAvailable: row.stock_available,
      })));
    } catch (error) { next(error); }
  });

  app.patch('/products/:id', async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const patch = productPatch.parse(request.body);
      const [result] = await pool.execute<import('mysql2').ResultSetHeader>(
        'UPDATE products SET unit_price_minor = COALESCE(?, unit_price_minor), active = COALESCE(?, active) WHERE id = ?',
        [patch.unitPriceMinor ?? null, patch.active === undefined ? null : Number(patch.active), id],
      );
      if (!result.affectedRows) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      const [rows] = await pool.query<(RowDataPacket & {
        name: string; active: number; unit_price_minor: string; stock_available: number;
      })[]>('SELECT name, active, unit_price_minor, stock_available FROM products WHERE id = ?', [id]);
      response.json({
        id, name: rows[0].name, active: Boolean(rows[0].active),
        unitPriceMinor: Number(rows[0].unit_price_minor), currency: 'USD', stockAvailable: rows[0].stock_available,
      });
    } catch (error) { next(error); }
  });

  app.post('/orders', async (request, response, next) => {
    try {
      const { items } = orderInput.parse(request.body);
      const key = request.header('Idempotency-Key');
      if (!key || key.length > 120 || !/^[\w.-]+$/.test(key)) {
        throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required');
      }
      const result = await orders.create(items, key);
      response.status(result.replayed ? 200 : 201).json(result.order);
    } catch (error) { next(error); }
  });

  app.get('/orders', async (_request, response, next) => {
    try { response.json(await orders.list()); } catch (error) { next(error); }
  });

  app.get('/orders/:id', async (request, response, next) => {
    try { response.json(await orders.get(idSchema.parse(request.params.id))); } catch (error) { next(error); }
  });

  app.post('/orders/:id/cancel', async (request, response, next) => {
    try { response.json(await orders.cancel(idSchema.parse(request.params.id))); } catch (error) { next(error); }
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  };
  app.use(errorHandler);
  return app;
}
