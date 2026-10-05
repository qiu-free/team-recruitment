import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { createDemoStore } from '../server/memory-store';

async function login(username: string, store: ReturnType<typeof createDemoStore>) {
  const app = await createApp({ store });
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'demo1234' } });
  return { app, cookie: response.headers['set-cookie'] };
}

describe('application review rules', () => {
  it('allows only the project owner to review and preserves the losing pending application', async () => {
    const store = createDemoStore();
    const { app: bobApp, cookie: bobCookie } = await login('bob', store);
    const forbidden = await bobApp.inject({ method: 'POST', url: '/api/applications/application_c_open/approve', headers: { cookie: bobCookie } });
    expect(forbidden.statusCode).toBe(403);
    await bobApp.close();

    const { app: ownerApp, cookie: ownerCookie } = await login('alice', store);
    const [first, second] = await Promise.all([
      ownerApp.inject({ method: 'POST', url: '/api/applications/application_b_open/approve', headers: { cookie: ownerCookie } }),
      ownerApp.inject({ method: 'POST', url: '/api/applications/application_c_open/approve', headers: { cookie: ownerCookie } })
    ]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
    const project = await ownerApp.inject({ method: 'GET', url: '/api/projects/project_open', headers: { cookie: ownerCookie } });
    expect(project.json().project.roles.find((role: { id: string }) => role.id === 'role_open_frontend')).toMatchObject({ joinedCount: 1, remaining: 0 });
    const statuses = project.json().project.applications.map((application: { status: string }) => application.status).sort();
    expect(statuses).toEqual(['approved', 'pending']);
    await ownerApp.close();
  });

  it('does not duplicate a member when accepting the same application twice', async () => {
    const store = createDemoStore();
    const { app, cookie } = await login('alice', store);
    const first = await app.inject({ method: 'POST', url: '/api/applications/application_b_open/approve', headers: { cookie } });
    const second = await app.inject({ method: 'POST', url: '/api/applications/application_b_open/approve', headers: { cookie } });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().result.alreadyProcessed).toBe(true);
    const project = await app.inject({ method: 'GET', url: '/api/projects/project_open', headers: { cookie } });
    expect(project.json().project.members.filter((member: { userId: string }) => member.userId === 'user_b')).toHaveLength(1);
    await app.close();
  });
});
