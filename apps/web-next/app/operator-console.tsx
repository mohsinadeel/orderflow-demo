'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Product = { id: string; name: string; active: boolean; unitPriceMinor: number; currency: string; stockAvailable: number };
type Order = { id: string; status: 'reserved' | 'cancelled'; totalMinor: number; currency: string; items: Array<{ productId: string; productName: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }> };

const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(`/api/orderflow${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body;
}

export function OperatorConsole() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextProducts, nextOrders] = await Promise.all([jsonRequest('/products'), jsonRequest('/orders')]);
      setProducts(nextProducts); setOrders(nextOrders);
      if (!selected && nextProducts[0]) setSelected(nextProducts[0].id);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load OrderFlow'); }
  }, [selected]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const order = await jsonRequest('/orders', {
        method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ items: [{ productId: selected, quantity: Number(quantity) }] }),
      });
      setMessage(`Order ${order.id.slice(0, 8)} reserved successfully.`); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Order could not be created'); await refresh(); }
    finally { setBusy(false); }
  }

  async function cancel(order: Order) {
    setBusy(true); setError(''); setMessage('');
    try { await jsonRequest(`/orders/${order.id}/cancel`, { method: 'POST' }); setMessage(`Order ${order.id.slice(0, 8)} cancelled; stock released.`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Cancellation failed'); }
    finally { setBusy(false); }
  }

  return <main>
    <header><div><p className="eyebrow">ORDERFLOW / LOCAL OPERATOR</p><h1>Reservation desk</h1><p className="lede">Create and cancel synthetic orders while watching inventory move atomically.</p></div><span className="status">NestJS API · local</span></header>
    <div className="announcer" aria-live="polite">{error && <p className="alert error"><strong>Request failed.</strong> {error}</p>}{message && <p className="alert success">{message}</p>}</div>
    <section className="grid" aria-label="Order workflow">
      <form className="panel order-form" onSubmit={submit}><p className="step">01 / RESERVE</p><h2>Create order</h2>
        <label htmlFor="product">Product</label><select id="product" value={selected} onChange={e => setSelected(e.target.value)} required>{products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} — {p.stockAvailable} available</option>)}</select>
        <label htmlFor="quantity">Quantity</label><input id="quantity" inputMode="numeric" type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
        <button disabled={busy || !selected}>{busy ? 'Working…' : 'Reserve stock'}</button><p className="hint">Try a quantity above availability to verify the unchanged-stock error path.</p>
      </form>
      <section className="panel"><p className="step">02 / INVENTORY</p><h2>Catalogue</h2><div className="product-list">{products.map(p => <article key={p.id} className="product"><div><h3>{p.name}</h3><p>{money(p.unitPriceMinor)} · {p.active ? 'Active' : 'Inactive'}</p></div><strong>{p.stockAvailable}<small> available</small></strong></article>)}</div></section>
    </section>
    <section className="panel orders"><div className="section-heading"><div><p className="step">03 / REVIEW</p><h2>Recent orders</h2></div><button className="secondary" onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
      {orders.length === 0 ? <p className="empty">No orders yet.</p> : <div className="order-list">{orders.slice(0, 12).map(o => <article className="order" key={o.id}><div><span className={`badge ${o.status}`}>{o.status}</span><h3>{o.items.map(i => `${i.quantity} × ${i.productName}`).join(', ')}</h3><p>{o.id} · {money(o.totalMinor)}</p></div>{o.status === 'reserved' && <button className="secondary danger" onClick={() => void cancel(o)} disabled={busy}>Cancel and release</button>}</article>)}</div>}
    </section>
  </main>;
}
