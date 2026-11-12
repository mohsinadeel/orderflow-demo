import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const baseUrl = process.env.ORDERFLOW_BASE_URL ?? 'http://localhost:8085';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  return { status: response.status, body: await response.json() as any };
}

async function product(stockAvailable: number, unitPriceMinor = 1250) {
  const result = await request('/products', {
    method: 'POST',
    body: JSON.stringify({ name: `Synthetic product ${randomUUID()}`, stockAvailable, unitPriceMinor }),
  });
  expect(result.status).toBe(201);
  return result.body as { id: string };
}

async function order(items: Array<{ productId: string; quantity: number }>, key = randomUUID()) {
  return request('/orders', {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ items }),
  });
}

describe('OrderFlow black-box contract', () => {
  it('creates a multi-item order with captured prices and reservations', async () => {
    const a = await product(5, 1200);
    const b = await product(3, 350);
    const created = await order([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }]);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('reserved');
    expect(created.body.totalMinor).toBe(2750);
    expect(created.body.items).toHaveLength(2);
    const listing = await request('/products');
    expect(listing.body.find((item: any) => item.id === a.id).stockAvailable).toBe(3);
    expect(listing.body.find((item: any) => item.id === b.id).stockAvailable).toBe(2);
  });

  it('rejects invalid quantities and insufficient stock without partial changes', async () => {
    const a = await product(1);
    const b = await product(0);
    const invalid = await order([{ productId: a.id, quantity: 0 }]);
    expect(invalid.status).toBe(400);
    const short = await order([{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }]);
    expect(short.status).toBe(409);
    expect(short.body.error.code).toBe('INSUFFICIENT_STOCK');
    const listing = await request('/products');
    expect(listing.body.find((item: any) => item.id === a.id).stockAvailable).toBe(1);
  });

  it('allows exactly one competing order for the last five units', async () => {
    const item = await product(5);
    const results = await Promise.all([
      order([{ productId: item.id, quantity: 4 }]),
      order([{ productId: item.id, quantity: 3 }]),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    const listing = await request('/products');
    expect([1, 2]).toContain(listing.body.find((row: any) => row.id === item.id).stockAvailable);
  });

  it('replays a matching key, rejects changed content, and releases stock once', async () => {
    const item = await product(6);
    const key = randomUUID();
    const lines = [{ productId: item.id, quantity: 2 }];
    const first = await order(lines, key);
    expect(first.status).toBe(201);
    const replay = await order(lines, key);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);
    const conflict = await order([{ productId: item.id, quantity: 1 }], key);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const cancelled = await request(`/orders/${first.body.id}/cancel`, { method: 'POST' });
    expect(cancelled.body.status).toBe('cancelled');
    expect((await request(`/orders/${first.body.id}/cancel`, { method: 'POST' })).status).toBe(200);
    const listing = await request('/products');
    expect(listing.body.find((row: any) => row.id === item.id).stockAvailable).toBe(6);
  });

  it('creates only one reservation for concurrent requests with the same key', async () => {
    const item = await product(5);
    const key = randomUUID();
    const lines = [{ productId: item.id, quantity: 2 }];
    const results = await Promise.all([order(lines, key), order(lines, key)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    const listing = await request('/products');
    expect(listing.body.find((row: any) => row.id === item.id).stockAvailable).toBe(3);
  });

  it('keeps captured prices and rejects inactive products', async () => {
    const item = await product(5, 900);
    const first = await order([{ productId: item.id, quantity: 1 }]);
    expect(first.status).toBe(201);
    const changed = await request(`/products/${item.id}`, {
      method: 'PATCH', body: JSON.stringify({ unitPriceMinor: 1100, active: false }),
    });
    expect(changed.status).toBe(200);
    expect(changed.body.unitPriceMinor).toBe(1100);
    const old = await request(`/orders/${first.body.id}`);
    expect(old.body.totalMinor).toBe(900);
    expect(old.body.items[0].unitPriceMinor).toBe(900);
    const rejected = await order([{ productId: item.id, quantity: 1 }]);
    expect(rejected.status).toBe(404);
    expect(rejected.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rolls back the order and reservation after an injected database-path failure', async () => {
    const item = await product(5);
    const ordersBefore = await request('/orders');
    const failed = await order(
      [{ productId: item.id, quantity: 2 }],
      `test-fail-after-reservation-${randomUUID()}`,
    );
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe('INTERNAL_ERROR');

    const listing = await request('/products');
    expect(listing.body.find((row: any) => row.id === item.id).stockAvailable).toBe(5);
    const ordersAfter = await request('/orders');
    expect(ordersAfter.body).toHaveLength(ordersBefore.body.length);
  });
});
