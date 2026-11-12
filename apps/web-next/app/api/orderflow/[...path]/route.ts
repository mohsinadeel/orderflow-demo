import type { NextRequest } from 'next/server';

const apiUrl = process.env.ORDERFLOW_API_URL ?? 'http://localhost:8085';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const idempotencyKey = request.headers.get('idempotency-key');
  if (contentType) headers.set('content-type', contentType);
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
  const body = request.method === 'GET' ? undefined : await request.text();
  try {
    const upstream = await fetch(`${apiUrl}/${path.join('/')}`, { method: request.method, headers, body, cache: 'no-store' });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return Response.json({ error: { code: 'API_UNAVAILABLE', message: 'Order service is unavailable' } }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
