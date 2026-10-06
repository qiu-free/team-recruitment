import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { createDemoStore } from '../server/memory-store';

const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.SESSION_SECRET;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
});

describe('session secret configuration', () => {
  it('refuses to start outside tests without an explicit high-entropy secret', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;

    await expect((async () => {
      const app = await createApp({ store: createDemoStore() });
      await app.close();
    })()).rejects.toThrow('SESSION_SECRET_REQUIRED');
  });

  it('refuses a configured secret shorter than 32 characters', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'too-short';

    await expect((async () => {
      const app = await createApp({ store: createDemoStore() });
      await app.close();
    })()).rejects.toThrow('SESSION_SECRET_TOO_SHORT');
  });
});
