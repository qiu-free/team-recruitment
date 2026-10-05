import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { AppOptions } from './types';

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cookie);

  app.get('/api/health', async () => ({ ok: true, service: 'team-recruitment' }));

  return app;
}
