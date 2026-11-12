import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DATABASE_POOL } from './database.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  @Get() async health() {
    await this.pool.query('SELECT 1');
    return { status: 'ok' };
  }
}
