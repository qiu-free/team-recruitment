import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app';

describe('server foundation', () => {
  it('exposes a health response without requiring the database', async () => {
    const app = await createApp({ database: false });
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: 'team-recruitment' });
    await app.close();
  });
});
