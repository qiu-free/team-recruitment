import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createApp, resolveClientRoot } from '../server/app';

describe('production static assets', () => {
  it('keeps the production server launcher in runtime dependencies', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(packageJson.dependencies?.tsx).toBeTruthy();
    expect(packageJson.devDependencies?.tsx).toBeUndefined();
  });

  it('resolves the client bundle from the project location instead of the launch directory', () => {
    expect(resolveClientRoot()).toMatch(/[\\/]dist[\\/]client$/);
  });

  it('serves the JavaScript bundle referenced by the built index', async () => {
    const index = readFileSync(new URL('../dist/client/index.html', import.meta.url), 'utf8');
    const match = index.match(/src="([^"]+\.js)"/);
    expect(match?.[1]).toBeTruthy();

    const app = await createApp({ database: false });
    const response = await app.inject({ method: 'GET', url: match![1] });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('javascript');
    expect(response.body.length).toBeGreaterThan(1000);
    await app.close();
  });
});
