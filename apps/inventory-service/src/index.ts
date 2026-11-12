import { app } from './app.js';
import { pool } from './db.js';

const server = app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
}
