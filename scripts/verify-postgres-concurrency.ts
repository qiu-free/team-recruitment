import assert from 'node:assert/strict';
import { createApp } from '../server/app';
import { createPool, createPostgresStore } from '../server/db';

const pool = createPool();
const app = await createApp({ store: createPostgresStore(pool) });

async function login(username: string): Promise<string | string[] | undefined> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'demo1234' } });
  assert.equal(response.statusCode, 200, `${username} login failed`);
  return response.headers['set-cookie'];
}

let projectId: string | undefined;
try {
  const aliceCookie = await login('alice');
  const bobCookie = await login('bob');
  const cathyCookie = await login('cathy');
  const created = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie: aliceCookie },
    payload: {
      title: `Postgres并发验收-${Date.now()}`,
      goal: '验证数据库事务名额一致性',
      progress: '自动化验证中',
      expectedOutcome: '同一名额最多加入一人',
      roles: [{ name: '并发验证角色', skills: ['测试'], capacity: 1 }]
    }
  });
  assert.equal(created.statusCode, 200, created.body);
  projectId = created.json().project.id;
  const roleId = created.json().project.roles[0].id;

  const [bobApplication, cathyApplication] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/projects/${projectId}/applications`, headers: { cookie: bobCookie }, payload: { roleId, reason: '验证并发', contribution: '负责测试' } }),
    app.inject({ method: 'POST', url: `/api/projects/${projectId}/applications`, headers: { cookie: cathyCookie }, payload: { roleId, reason: '验证并发', contribution: '负责复核' } })
  ]);
  assert.equal(bobApplication.statusCode, 201, bobApplication.body);
  assert.equal(cathyApplication.statusCode, 201, cathyApplication.body);

  const bobId = bobApplication.json().application.id;
  const cathyId = cathyApplication.json().application.id;
  const [first, second] = await Promise.all([
    app.inject({ method: 'POST', url: `/api/applications/${bobId}/approve`, headers: { cookie: aliceCookie } }),
    app.inject({ method: 'POST', url: `/api/applications/${cathyId}/approve`, headers: { cookie: aliceCookie } })
  ]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);

  const detail = await app.inject({ method: 'GET', url: `/api/projects/${projectId}`, headers: { cookie: aliceCookie } });
  assert.equal(detail.statusCode, 200, detail.body);
  const result = detail.json().project;
  assert.deepEqual(result.roles.find((role: { id: string }) => role.id === roleId), { ...result.roles.find((role: { id: string }) => role.id === roleId), joinedCount: 1, remaining: 0 });
  assert.deepEqual(result.applications.map((application: { status: string }) => application.status).sort(), ['approved', 'pending']);
  console.log('PostgreSQL concurrency verification passed: one approval, one ROLE_FULL, no over-capacity member.');
} finally {
  if (projectId) await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
  await app.close();
  await pool.end();
}
