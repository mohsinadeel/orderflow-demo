import mysql from 'mysql2/promise';

const prefix = process.env.DB_TABLE_PREFIX ?? '';
if (!/^[A-Za-z0-9_]*$/.test(prefix)) {
  throw new Error('DB_TABLE_PREFIX may contain only letters, numbers and underscores');
}

const table = name => `\`${prefix}${name}\``;
const products = table('products');
const orders = table('orders');
const orderItems = table('order_items');
const reservations = table('reservations');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_DATABASE ?? 'orderflow',
  user: process.env.DB_USER ?? 'orderflow',
  password: process.env.DB_PASSWORD ?? 'local_orderflow_password',
  multipleStatements: false,
});

try {
  await connection.execute(`CREATE TABLE IF NOT EXISTS ${products} (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    unit_price_minor BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    stock_available INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.execute(`CREATE TABLE IF NOT EXISTS ${orders} (
    id CHAR(36) PRIMARY KEY,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    request_fingerprint CHAR(64) NOT NULL,
    status ENUM('reserved', 'cancelled') NOT NULL,
    total_minor BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.execute(`CREATE TABLE IF NOT EXISTS ${orderItems} (
    order_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    product_name_snapshot VARCHAR(160) NOT NULL,
    unit_price_minor BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total_minor BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (order_id, product_id),
    CONSTRAINT \`${prefix}fk_items_order\` FOREIGN KEY (order_id) REFERENCES ${orders}(id),
    CONSTRAINT \`${prefix}fk_items_product\` FOREIGN KEY (product_id) REFERENCES ${products}(id)
  ) ENGINE=InnoDB`);
  await connection.execute(`CREATE TABLE IF NOT EXISTS ${reservations} (
    id CHAR(36) PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    status ENUM('active', 'released') NOT NULL,
    UNIQUE KEY \`${prefix}uq_reservation_order_product\` (order_id, product_id),
    CONSTRAINT \`${prefix}fk_reservations_order\` FOREIGN KEY (order_id) REFERENCES ${orders}(id),
    CONSTRAINT \`${prefix}fk_reservations_product\` FOREIGN KEY (product_id) REFERENCES ${products}(id)
  ) ENGINE=InnoDB`);
  await connection.execute(`INSERT IGNORE INTO ${products}
    (id, name, active, unit_price_minor, currency, stock_available) VALUES
    ('10000000-0000-4000-8000-000000000001', 'Desk Lamp', TRUE, 1299, 'USD', 8),
    ('10000000-0000-4000-8000-000000000002', 'Cable Organiser', TRUE, 699, 'USD', 12),
    ('10000000-0000-4000-8000-000000000003', 'Travel Mug', TRUE, 1899, 'USD', 6)`);
  console.log(`OrderFlow schema is ready with prefix "${prefix}".`);
} finally {
  await connection.end();
}
