import { createApp } from './app';
import { createPool, createPostgresStore } from './db';
import { createDemoStore } from './memory-store';

const port = Number(process.env.PORT ?? 3000);
const pool = process.env.DATABASE_URL ? createPool() : null;
const app = await createApp({ store: pool ? createPostgresStore(pool) : createDemoStore() });

await app.listen({ port, host: '0.0.0.0' });

const shutdown = async () => {
  await app.close();
  await pool?.end();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
