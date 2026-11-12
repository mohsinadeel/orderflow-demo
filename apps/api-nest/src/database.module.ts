import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import mysql, { type Pool } from 'mysql2/promise';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

@Injectable()
class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() { await this.pool.end(); }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => mysql.createPool({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 3306),
        database: process.env.DB_DATABASE ?? 'orderflow',
        user: process.env.DB_USER ?? 'orderflow',
        password: process.env.DB_PASSWORD ?? 'local_orderflow_password',
        waitForConnections: true,
        connectionLimit: 10,
        decimalNumbers: false,
      }),
    },
    DatabaseShutdown,
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
