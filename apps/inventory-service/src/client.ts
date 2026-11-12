export class InventoryClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export class InventoryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly attempts = 3,
    private readonly timeoutMs = 200,
  ) {}

  async reserve(operationId: string, orderId: string, items: Array<{ productId: string; quantity: number }>, fault?: string) {
    return this.request('/reservations', operationId, { orderId, items }, fault);
  }

  private async request(path: string, operationId: string, body: unknown, fault?: string): Promise<any> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationId, ...(fault ? { 'X-Inventory-Fault': fault } : {}) },
          body: JSON.stringify(body),
        });
        const result = await response.json() as any;
        if (response.ok) return result;
        const error = new InventoryClientError(response.status, result.error?.code ?? 'INVENTORY_ERROR', result.error?.message ?? 'Inventory request failed');
        if (response.status < 500 || attempt === this.attempts) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof InventoryClientError) throw error;
        lastError = error;
        if (attempt === this.attempts) throw new InventoryClientError(503, 'INVENTORY_UNAVAILABLE', 'Inventory request failed after retry budget');
      } finally { clearTimeout(timer); }
      await new Promise(resolve => setTimeout(resolve, 20 * attempt));
    }
    throw lastError;
  }
}
