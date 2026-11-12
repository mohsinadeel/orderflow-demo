import { describe, expect, it } from 'vitest';

const baseUrl = process.env.ORDERFLOW_BASE_URL ?? 'http://localhost:8085';

describe('OrderFlow browser API documentation', () => {
  it('serves Swagger UI and a complete OpenAPI document', async () => {
    const page = await fetch(`${baseUrl}/api/docs`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('OrderFlow REST API');

    const response = await fetch(`${baseUrl}/api/openapi.json`);
    expect(response.status).toBe(200);
    const document = await response.json() as any;
    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths['/products'].post.responses['201']).toBeDefined();
    expect(document.paths['/orders'].post.parameters).toContainEqual(expect.objectContaining({
      in: 'header', name: 'Idempotency-Key', required: true,
    }));
    expect(document.paths['/orders/{id}/cancel'].post.responses['200']).toBeDefined();
    expect(document.components.schemas.CreateProductDto.properties.unitPriceMinor.example).toBe(1250);
    expect(document.components.schemas.ErrorResponse).toBeDefined();
  });

  it('adds rate-limit response headers to the public API', async () => {
    const response = await fetch(`${baseUrl}/products`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-ratelimit-limit')).toBe('600');
    expect(Number(response.headers.get('x-ratelimit-remaining'))).toBeGreaterThanOrEqual(0);
  });

  it('rejects oversized JSON before domain processing', async () => {
    const response = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(40_000), unitPriceMinor: 100, stockAvailable: 1 }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large' },
    });
  });
});
