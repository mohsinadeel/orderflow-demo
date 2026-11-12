import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InventoryClient, InventoryClientError } from '../src/client.js';

const baseUrl = process.env.INVENTORY_BASE_URL ?? 'http://localhost:8087';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  return { status: response.status, body: await response.json() as any };
}

async function register(stockAvailable: number) {
  const productId = randomUUID();
  const result = await request('/items', {
    method: 'POST', headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ productId, stockAvailable }),
  });
  expect(result.status).toBe(201);
  return productId;
}

async function item(productId: string) {
  const result = await request(`/items/${productId}`);
  expect(result.status).toBe(200);
  return result.body as { stockAvailable: number };
}

describe('isolated inventory-service experiment', () => {
  it('rolls back every line when a failure occurs before commit', async () => {
    const first = await register(5);
    const second = await register(4);
    const result = await request('/reservations', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID(), 'X-Inventory-Fault': 'fail-before-commit' },
      body: JSON.stringify({ orderId: randomUUID(), items: [{ productId: first, quantity: 2 }, { productId: second, quantity: 3 }] }),
    });
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe('INJECTED_FAILURE');
    expect((await item(first)).stockAvailable).toBe(5);
    expect((await item(second)).stockAvailable).toBe(4);
  });

  it('reports unavailable inventory after a bounded retry budget without changing stock', async () => {
    const productId = await register(3);
    const client = new InventoryClient(baseUrl, 3, 200);
    await expect(client.reserve(randomUUID(), randomUUID(), [{ productId, quantity: 1 }], 'unavailable'))
      .rejects.toMatchObject<Partial<InventoryClientError>>({ status: 503, code: 'INVENTORY_UNAVAILABLE' });
    expect((await item(productId)).stockAvailable).toBe(3);
  });

  it('maps a refused network connection to unavailable after bounded retries', async () => {
    const client = new InventoryClient('http://127.0.0.1:65534', 3, 50);
    await expect(client.reserve(randomUUID(), randomUUID(), [{ productId: randomUUID(), quantity: 1 }]))
      .rejects.toMatchObject<Partial<InventoryClientError>>({ status: 503, code: 'INVENTORY_UNAVAILABLE' });
  });

  it('retries a lost post-commit response without reserving twice', async () => {
    const productId = await register(5);
    const operationId = randomUUID();
    const orderId = randomUUID();
    const client = new InventoryClient(baseUrl, 3, 50);
    const result = await client.reserve(operationId, orderId, [{ productId, quantity: 2 }], 'delay-after-commit');
    expect(result).toMatchObject({ orderId, status: 'active', replayed: true });
    expect((await item(productId)).stockAvailable).toBe(3);
    const stored = await request(`/reservations/${orderId}`);
    expect(stored.body.items).toEqual([{ productId, quantity: 2 }]);
  });

  it('rejects changed content for one operation ID and releases once on duplicate delivery', async () => {
    const productId = await register(4);
    const operationId = randomUUID();
    const orderId = randomUUID();
    const created = await request('/reservations', {
      method: 'POST', headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify({ orderId, items: [{ productId, quantity: 2 }] }),
    });
    expect(created.status).toBe(201);
    const conflict = await request('/reservations', {
      method: 'POST', headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify({ orderId, items: [{ productId, quantity: 1 }] }),
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const releaseOperation = randomUUID();
    const release = () => request(`/reservations/${orderId}/release`, {
      method: 'POST', headers: { 'Idempotency-Key': releaseOperation },
    });
    expect((await release()).body.replayed).toBe(false);
    expect((await release()).body.replayed).toBe(true);
    expect((await item(productId)).stockAvailable).toBe(4);
  });
});
