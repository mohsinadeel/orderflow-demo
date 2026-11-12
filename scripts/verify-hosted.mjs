import { randomUUID } from 'node:crypto';

const confirmation = process.env.ORDERFLOW_HOSTED_TEST_CONFIRMATION;
if (confirmation !== 'TEST-ORDERFLOW-HOSTED-MUTATIONS') {
  throw new Error('Hosted verification refused: set ORDERFLOW_HOSTED_TEST_CONFIRMATION=TEST-ORDERFLOW-HOSTED-MUTATIONS');
}

const baseUrl = (process.env.ORDERFLOW_HOSTED_BASE_URL ?? '').replace(/\/+$/, '');
if (baseUrl !== 'https://demo.mohsinadeel.dev/orderflow-api') {
  throw new Error('Hosted verification requires the exact production API URL');
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json();
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createProduct(stockAvailable) {
  const result = await request('/products', {
    method: 'POST',
    body: JSON.stringify({ name: `Hosted verification ${randomUUID()}`, stockAvailable, unitPriceMinor: 1250 }),
  });
  assert(result.status === 201, `Product creation returned ${result.status}`);
  return result.body;
}

async function createOrder(productId, quantity, key) {
  return request('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ items: [{ productId, quantity }] }),
  });
}

const smokeProduct = await createProduct(5);
const smokeKey = `hosted-smoke-${randomUUID()}`;
const created = await createOrder(smokeProduct.id, 2, smokeKey);
assert(created.status === 201, `Order creation returned ${created.status}`);
const replay = await createOrder(smokeProduct.id, 2, smokeKey);
assert(replay.status === 200 && replay.body.id === created.body.id, 'Idempotent replay did not return the original order');
const conflict = await createOrder(smokeProduct.id, 1, smokeKey);
assert(conflict.status === 409 && conflict.body.error?.code === 'IDEMPOTENCY_CONFLICT', 'Changed replay was not rejected');
const cancelled = await request(`/orders/${created.body.id}/cancel`, { method: 'POST' });
assert(cancelled.status === 200 && cancelled.body.status === 'cancelled', 'Cancellation failed');
const cancelledAgain = await request(`/orders/${created.body.id}/cancel`, { method: 'POST' });
assert(cancelledAgain.status === 200, 'Repeated cancellation failed');

const raceProduct = await createProduct(5);
const competing = await Promise.all([
  createOrder(raceProduct.id, 4, `hosted-race-a-${randomUUID()}`),
  createOrder(raceProduct.id, 3, `hosted-race-b-${randomUUID()}`),
]);
assert(competing.map(result => result.status).sort().join(',') === '201,409', 'Competing orders did not produce one success and one conflict');
const winner = competing.find(result => result.status === 201);
await request(`/orders/${winner.body.id}/cancel`, { method: 'POST' });

const replayProduct = await createProduct(5);
const concurrentKey = `hosted-replay-${randomUUID()}`;
const concurrent = await Promise.all([
  createOrder(replayProduct.id, 2, concurrentKey),
  createOrder(replayProduct.id, 2, concurrentKey),
]);
assert(concurrent.map(result => result.status).sort().join(',') === '200,201', 'Concurrent replay did not produce create and replay responses');
assert(concurrent[0].body.id === concurrent[1].body.id, 'Concurrent replay created different orders');
await request(`/orders/${concurrent[0].body.id}/cancel`, { method: 'POST' });

console.log('Hosted REST smoke and bounded concurrency verification passed.');
