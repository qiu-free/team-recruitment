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
    expect(cookie?.toString()).not.toContain('Secure');
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

  it('does not expose the owner password hash in public project details', async () => {
    const { app, cookie } = await loggedInApp();
    const response = await app.inject({ method: 'GET', url: '/api/projects/project_open', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().project.ownerProfile).not.toHaveProperty('passwordHash');
    await app.close();
  });

  it('keeps a valid session after the app process is recreated', async () => {
    const first = await loggedInApp('bob');
    const second = await createApp({ store: createDemoStore() });
    const response = await second.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: first.cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.username).toBe('bob');
    await first.app.close();
    await second.close();
  });

  it('invalidates the old session cookie after logout', async () => {
    const { app, cookie } = await loggedInApp('bob');
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    const replay = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(replay.statusCode).toBe(401);
    await app.close();
  });
});
