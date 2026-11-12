import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_DATABASE ?? 'orderflow_inventory',
  user: process.env.DB_USER ?? 'orderflow_inventory',
  password: process.env.DB_PASSWORD ?? 'local_inventory_password',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: false,
});
