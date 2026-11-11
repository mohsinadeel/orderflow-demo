import { createApp } from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT ?? 3000);
createApp(pool).listen(port, () => console.log(`OrderFlow Express listening on ${port}`));
