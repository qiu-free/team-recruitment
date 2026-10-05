import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { createDemoStore } from '../server/memory-store';

async function loggedInApp(username = 'bob') {
  const app = await createApp({ store: createDemoStore() });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'demo1234' } });
  const cookie = login.headers['set-cookie'];
  return { app, cookie };
}

describe('authentication and profile API', () => {
  it('logs in a seeded user and returns the current session', async () => {
    const { app, cookie } = await loggedInApp();
    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({ username: 'bob', nickname: '周予安' });
    await app.close();
  });

  it('updates profile data for the authenticated user', async () => {
    const { app, cookie } = await loggedInApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie },
      payload: { nickname: '周予安·新版', bio: '新的简介', skills: ['React', '测试'], weeklyHours: 9 }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().profile).toMatchObject({ nickname: '周予安·新版', weeklyHours: 9, skills: ['React', '测试'] });
    await app.close();
  });
});
