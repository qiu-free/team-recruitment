import { createApp } from './app';
import { createPool, createPostgresStore } from './db';

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();
const app = await createApp({ store: createPostgresStore(pool) });

await app.listen({ port, host: '0.0.0.0' });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
