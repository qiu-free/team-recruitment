import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { createDemoStore } from '../server/memory-store';

async function loggedIn(username: string) {
  const app = await createApp({ store: createDemoStore() });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'demo1234' } });
  return { app, cookie: login.headers['set-cookie'] };
}

describe('project and application workflow', () => {
  it('returns filtered projects and their calculated role capacity', async () => {
    const { app, cookie } = await loggedIn('bob');
    const response = await app.inject({ method: 'GET', url: '/api/projects?role=前端&skills=React,TypeScript', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().projects).toHaveLength(1);
    expect(response.json().projects[0].roles[0]).toMatchObject({ capacity: 1, joinedCount: 0, remaining: 1 });
    await app.close();
  });

  it('returns project and role labels in the application history', async () => {
    const { app, cookie } = await loggedIn('bob');
    const response = await app.inject({ method: 'GET', url: '/api/applications/mine', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().applications[0]).toMatchObject({ projectTitle: '校园智能导览', roleName: '前端开发' });
    await app.close();
  });

  it('prevents duplicate pending applications and keeps submitted profile snapshot', async () => {
    const { app: bobApp, cookie: bobCookie } = await loggedIn('bob');
    const first = await bobApp.inject({ method: 'POST', url: '/api/projects/project_paused/applications', headers: { cookie: bobCookie }, payload: { roleId: 'role_paused_data', reason: '我喜欢数据', contribution: '负责图表' } });
    expect(first.statusCode).toBe(403);

    const open = await bobApp.inject({ method: 'POST', url: '/api/projects/project_open/applications', headers: { cookie: bobCookie }, payload: { roleId: 'role_open_research', reason: '我喜欢调研', contribution: '负责访谈' } });
    expect(open.statusCode).toBe(409);
    await bobApp.close();

    const { app: davidApp, cookie: davidCookie } = await loggedIn('david');
    const created = await davidApp.inject({ method: 'POST', url: '/api/projects/project_open/applications', headers: { cookie: davidCookie }, payload: { roleId: 'role_open_research', reason: '我希望参与', contribution: '负责文档' } });
    expect(created.statusCode).toBe(201);
    expect(created.json().application.profileSnapshot).toMatchObject({ nickname: '陈默', skills: ['Node.js', 'PostgreSQL', '文档'] });
    const duplicate = await davidApp.inject({ method: 'POST', url: '/api/projects/project_open/applications', headers: { cookie: davidCookie }, payload: { roleId: 'role_open_research', reason: '重复申请', contribution: '重复' } });
    expect(duplicate.statusCode).toBe(409);
    await davidApp.close();
  });

  it('allows withdrawal and lets the same user apply again after rejection', async () => {
    const store = createDemoStore();
    const { app, cookie } = await (async () => {
      const nextApp = await createApp({ store });
      const login = await nextApp.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'david', password: 'demo1234' } });
      return { app: nextApp, cookie: login.headers['set-cookie'] };
    })();
    const created = await app.inject({ method: 'POST', url: '/api/projects/project_open/applications', headers: { cookie }, payload: { roleId: 'role_open_research', reason: '我希望参与', contribution: '负责文档' } });
    expect(created.statusCode).toBe(201);
    const applicationId = created.json().application.id;
    const withdrawn = await app.inject({ method: 'POST', url: `/api/applications/${applicationId}/withdraw`, headers: { cookie } });
    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json().application.status).toBe('withdrawn');
    const resubmitted = await app.inject({ method: 'POST', url: '/api/projects/project_open/applications', headers: { cookie }, payload: { roleId: 'role_open_research', reason: '再次申请', contribution: '负责文档和测试' } });
    expect(resubmitted.statusCode).toBe(201);
    await app.close();

    const aliceApp = await createApp({ store });
    const aliceLogin = await aliceApp.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'alice', password: 'demo1234' } });
    const aliceCookie = aliceLogin.headers['set-cookie'];
    const project = await aliceApp.inject({ method: 'GET', url: '/api/projects/project_open', headers: { cookie: aliceCookie } });
    expect(project.statusCode).toBe(200);
    expect(project.json().project.applications.filter((application: { applicantId: string }) => application.applicantId === 'user_d')).toHaveLength(2);
    const pending = project.json().project.applications.find((application: { applicantId: string; status: string }) => application.applicantId === 'user_d' && application.status === 'pending');
    const rejected = await aliceApp.inject({ method: 'POST', url: `/api/applications/${pending.id}/reject`, headers: { cookie: aliceCookie }, payload: { reason: '当前阶段需要更多用户访谈经验' } });
    expect(rejected.statusCode).toBe(200);
    await aliceApp.close();

    const davidApp = await createApp({ store });
    const davidLogin = await davidApp.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'david', password: 'demo1234' } });
    const davidCookie = davidLogin.headers['set-cookie'];
    const mine = await davidApp.inject({ method: 'GET', url: '/api/applications/mine', headers: { cookie: davidCookie } });
    expect(mine.json().applications.find((application: { status: string }) => application.status === 'rejected')?.rejectionReason).toBe('当前阶段需要更多用户访谈经验');
    const again = await davidApp.inject({ method: 'POST', url: '/api/projects/project_open/applications', headers: { cookie: davidCookie }, payload: { roleId: 'role_open_research', reason: '补充用户访谈经历后重新申请', contribution: '负责访谈记录' } });
    expect(again.statusCode).toBe(201);
    await davidApp.close();
  });

  it('keeps another applicant from reading private application content', async () => {
    const { app, cookie } = await loggedIn('cathy');
    const response = await app.inject({ method: 'GET', url: '/api/projects/project_open/applications', headers: { cookie } });
    expect(response.statusCode).toBe(403);
    const project = await app.inject({ method: 'GET', url: '/api/projects/project_open', headers: { cookie } });
    expect(project.json().project.applications).toHaveLength(1);
    expect(project.json().project.applications[0].id).toBe('application_c_open');
    expect(project.json().project.applications[0].reason).toBe('我正在学习前端，也能负责可视化部分。');
    await app.close();
  });
});
