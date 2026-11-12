import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DATABASE_POOL } from './database.module.js';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  @Get()
  @ApiOperation({ summary: 'Check API and database availability' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async health() {
    await this.pool.query('SELECT 1');
    return { status: 'ok' };
  }
}
