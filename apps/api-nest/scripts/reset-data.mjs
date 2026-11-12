import mysql from 'mysql2/promise';

if (process.env.ORDERFLOW_RESET_CONFIRMATION !== 'RESET-ORDERFLOW-DATA') {
  throw new Error('Reset refused: ORDERFLOW_RESET_CONFIRMATION must equal RESET-ORDERFLOW-DATA');
}

const prefix = process.env.DB_TABLE_PREFIX ?? '';
if (!prefix || !/^[A-Za-z0-9_]+$/.test(prefix)) {
  throw new Error('Reset requires a non-empty DB_TABLE_PREFIX containing only letters, numbers and underscores');
}

const table = name => `\`${prefix}${name}\``;
const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_DATABASE ?? 'orderflow',
  user: process.env.DB_USER ?? 'orderflow',
  password: process.env.DB_PASSWORD ?? 'local_orderflow_password',
});

try {
  await connection.beginTransaction();
  await connection.execute(`DELETE FROM ${table('reservations')}`);
  await connection.execute(`DELETE FROM ${table('order_items')}`);
  await connection.execute(`DELETE FROM ${table('orders')}`);
  await connection.execute(`DELETE FROM ${table('products')}`);
  await connection.execute(`INSERT INTO ${table('products')}
    (id, name, active, unit_price_minor, currency, stock_available) VALUES
    ('10000000-0000-4000-8000-000000000001', 'Desk Lamp', TRUE, 1299, 'USD', 8),
    ('10000000-0000-4000-8000-000000000002', 'Cable Organiser', TRUE, 699, 'USD', 12),
    ('10000000-0000-4000-8000-000000000003', 'Travel Mug', TRUE, 1899, 'USD', 6)`);
  await connection.commit();
  console.log(`OrderFlow data reset completed for prefix "${prefix}".`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
