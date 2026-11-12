import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const baseUrl = process.env.ORDERFLOW_BASE_URL ?? 'http://localhost:8085';

async function rest(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  return { status: response.status, body: await response.json() as any };
}

async function graphql(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return { status: response.status, body: await response.json() as any };
}

const productFields = 'id name active unitPriceMinor currency stockAvailable';
const orderFields = `id status currency totalMinor items {
  productId productName unitPriceMinor quantity lineTotalMinor
}`;

describe('OrderFlow REST and GraphQL parity', () => {
  it('produces equivalent reservation, query and cancellation outcomes', async () => {
    const suffix = randomUUID();
    const restProduct = await rest('/products', {
      method: 'POST',
      body: JSON.stringify({ name: `REST parity ${suffix}`, unitPriceMinor: 725, stockAvailable: 5 }),
    });
    const gqlProduct = await graphql(
      `mutation ($input: CreateProductInput!) {
        createProduct(input: $input) { ${productFields} }
      }`,
      { input: { name: `GraphQL parity ${suffix}`, unitPriceMinor: 725, stockAvailable: 5 } },
    );
    expect(restProduct.status).toBe(201);
    expect(gqlProduct.status).toBe(200);
    expect(gqlProduct.body.errors).toBeUndefined();

    const restOrder = await rest('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': `rest-${suffix}` },
      body: JSON.stringify({ items: [{ productId: restProduct.body.id, quantity: 2 }] }),
    });
    const gqlOrder = await graphql(
      `mutation ($input: CreateOrderInput!) {
        createOrder(input: $input) { ${orderFields} }
      }`,
      { input: { idempotencyKey: `graphql-${suffix}`, items: [{ productId: gqlProduct.body.data.createProduct.id, quantity: 2 }] } },
    );
    expect(restOrder.status).toBe(201);
    expect(gqlOrder.body.errors).toBeUndefined();
    expect(gqlOrder.body.data.createOrder).toMatchObject({ status: 'reserved', currency: 'USD', totalMinor: 1450 });
    expect(restOrder.body).toMatchObject({ status: 'reserved', currency: 'USD', totalMinor: 1450 });
    expect(gqlOrder.body.data.createOrder.items[0]).toMatchObject({ unitPriceMinor: 725, quantity: 2, lineTotalMinor: 1450 });
    expect(restOrder.body.items[0]).toMatchObject({ unitPriceMinor: 725, quantity: 2, lineTotalMinor: 1450 });

    const queried = await graphql(
      `query ($id: ID!) { order(id: $id) { ${orderFields} } }`,
      { id: gqlOrder.body.data.createOrder.id },
    );
    expect(queried.body.data.order).toEqual(gqlOrder.body.data.createOrder);

    const restCancelled = await rest(`/orders/${restOrder.body.id}/cancel`, { method: 'POST' });
    const gqlCancelled = await graphql(
      `mutation ($id: ID!) { cancelOrder(id: $id) { ${orderFields} } }`,
      { id: gqlOrder.body.data.createOrder.id },
    );
    expect(restCancelled.body.status).toBe('cancelled');
    expect(gqlCancelled.body.data.cancelOrder.status).toBe('cancelled');

    const products = await graphql(`query { products { ${productFields} } }`);
    const byId = new Map(products.body.data.products.map((item: any) => [item.id, item]));
    expect(byId.get(restProduct.body.id).stockAvailable).toBe(5);
    expect(byId.get(gqlProduct.body.data.createProduct.id).stockAvailable).toBe(5);
  });

  it('replays idempotently and returns coded domain errors', async () => {
    const suffix = randomUUID();
    const created = await graphql(
      `mutation ($input: CreateProductInput!) {
        createProduct(input: $input) { ${productFields} }
      }`,
      { input: { name: `GraphQL errors ${suffix}`, unitPriceMinor: 500, stockAvailable: 2 } },
    );
    const productId = created.body.data.createProduct.id;
    const input = { idempotencyKey: `graphql-replay-${suffix}`, items: [{ productId, quantity: 2 }] };
    const mutation = `mutation ($input: CreateOrderInput!) {
      createOrder(input: $input) { ${orderFields} }
    }`;
    const first = await graphql(mutation, { input });
    const replay = await graphql(mutation, { input });
    expect(replay.body.data.createOrder.id).toBe(first.body.data.createOrder.id);

    const conflict = await graphql(mutation, {
      input: { ...input, items: [{ productId, quantity: 1 }] },
    });
    expect(conflict.status).toBe(200);
    expect(conflict.body.data).toBeNull();
    expect(conflict.body.errors[0].extensions).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409,
    });

    const insufficient = await graphql(mutation, {
      input: { idempotencyKey: `graphql-short-${suffix}`, items: [{ productId, quantity: 1 }] },
    });
    expect(insufficient.body.errors[0].extensions).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      status: 409,
    });
    const products = await graphql(`query { products { id stockAvailable } }`);
    expect(products.body.data.products.find((item: any) => item.id === productId).stockAvailable).toBe(0);
  });

  it('preserves integer minor-unit values above the GraphQL Int range', async () => {
    const suffix = randomUUID();
    const created = await graphql(
      `mutation ($input: CreateProductInput!) {
        createProduct(input: $input) { ${productFields} }
      }`,
      { input: { name: `GraphQL large price ${suffix}`, unitPriceMinor: 3_000_000_000, stockAvailable: 1 } },
    );
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createProduct.unitPriceMinor).toBe(3_000_000_000);
    const ordered = await graphql(
      `mutation ($input: CreateOrderInput!) {
        createOrder(input: $input) { ${orderFields} }
      }`,
      {
        input: {
          idempotencyKey: `graphql-large-${suffix}`,
          items: [{ productId: created.body.data.createProduct.id, quantity: 1 }],
        },
      },
    );
    expect(ordered.body.errors).toBeUndefined();
    expect(ordered.body.data.createOrder.totalMinor).toBe(3_000_000_000);
    expect(ordered.body.data.createOrder.items[0].lineTotalMinor).toBe(3_000_000_000);
  });
});
