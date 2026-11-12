const prefix = process.env.DB_TABLE_PREFIX ?? '';

if (!/^[A-Za-z0-9_]*$/.test(prefix)) {
  throw new Error('DB_TABLE_PREFIX may contain only letters, numbers and underscores');
}

function table(name: string) {
  return `\`${prefix}${name}\``;
}

export const TABLES = {
  products: table('products'),
  orders: table('orders'),
  orderItems: table('order_items'),
  reservations: table('reservations'),
} as const;
