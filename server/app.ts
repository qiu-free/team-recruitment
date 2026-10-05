import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { AppOptions, CreateApplicationInput, CreateProjectInput, Profile, Store } from './types';
import { createDemoStore } from './memory-store';
import { hashPassword, verifyPassword } from './security';

type BodyRequest<T> = FastifyRequest<{ Body: T }>;
type IdRequest = FastifyRequest<{ Params: { id: string } }>;
type ProjectApplicationRequest = FastifyRequest<{ Params: { id: string } }>;

const sessionCookie = 'team_session';

function errorStatus(code: string): number {
  if (code === 'FORBIDDEN' || code === 'OWNER_CANNOT_APPLY' || code === 'RECRUITMENT_PAUSED') return 403;
  if (code === 'NOT_FOUND' || code === 'PROJECT_NOT_FOUND' || code === 'USER_NOT_FOUND') return 404;
  if (code === 'ROLE_FULL') return 409;
  if (code === 'PENDING_APPLICATION_EXISTS' || code === 'ALREADY_MEMBER' || code === 'APPLICATION_ALREADY_PROCESSED') return 409;
  return 400;
}

function sendError(reply: FastifyReply, error: unknown) {
  const code = error instanceof Error ? error.message : 'BAD_REQUEST';
  return reply.code(errorStatus(code)).send({ error: code, message: friendlyError(code) });
}

function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    OWNER_CANNOT_APPLY: '项目发起人不能申请加入自己的项目。',
    RECRUITMENT_PAUSED: '项目目前暂停招募，暂不接收新申请。',
    ROLE_FULL: '该角色名额已满，当前申请仍未改变其他申请状态。',
    PENDING_APPLICATION_EXISTS: '你在本项目已有一条待审核申请。',
    ALREADY_MEMBER: '你已经是本项目成员。',
    APPLICATION_ALREADY_PROCESSED: '这条申请已经处理，不能重复操作。',
    FORBIDDEN: '你没有权限执行此操作。',
    UNAUTHORIZED: '请先登录。',
    INVALID_CREDENTIALS: '账号或密码错误。',
    PROJECT_NOT_FOUND: '项目不存在。',
    NOT_FOUND: '请求的数据不存在。'
  };
  return messages[code] ?? code;
}

function requireUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = (request as FastifyRequest & { userId?: string }).userId;
  if (!userId) {
    void sendError(reply, new Error('UNAUTHORIZED'));
    return null;
  }
  return userId;
}

function profileFromBody(body: Partial<Profile>): Profile {
  const skills = Array.isArray(body.skills) ? body.skills.map(String).map((skill) => skill.trim()).filter(Boolean) : [];
  const weeklyHours = Number(body.weeklyHours ?? 0);
  if (!String(body.nickname ?? '').trim() || !Number.isInteger(weeklyHours) || weeklyHours < 0 || weeklyHours > 168) throw new Error('INVALID_PROFILE');
  return { nickname: String(body.nickname).trim(), bio: String(body.bio ?? '').trim(), skills, weeklyHours };
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  const store: Store = options.store ?? createDemoStore();
  const sessions = new Map<string, string>();

  const clientRoot = join(process.cwd(), 'dist', 'client');
  if (existsSync(clientRoot)) {
    await app.register(fastifyStatic, { root: clientRoot, wildcard: false });
  }

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[sessionCookie];
    if (token) (request as FastifyRequest & { userId?: string }).userId = sessions.get(token);
  });

  app.get('/api/health', async () => ({ ok: true, service: 'team-recruitment' }));

  app.post('/api/auth/login', async (request: BodyRequest<{ username?: string; password?: string }>, reply) => {
    const username = String(request.body?.username ?? '').trim();
    const password = String(request.body?.password ?? '');
    const user = await store.getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) return sendError(reply, new Error('INVALID_CREDENTIALS'));
    const token = randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    reply.setCookie(sessionCookie, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    return { user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (token) sessions.delete(token);
    reply.clearCookie(sessionCookie, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const user = await store.getUserById(userId);
    if (!user) return sendError(reply, new Error('UNAUTHORIZED'));
    return { user: publicUser(user) };
  });

  app.get('/api/profile', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const user = await store.getUserById(userId);
    if (!user) return sendError(reply, new Error('UNAUTHORIZED'));
    return { profile: publicUser(user) };
  });

  app.patch('/api/profile', async (request: BodyRequest<Partial<Profile>>, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      return { profile: publicUser(await store.updateProfile(userId, profileFromBody(request.body ?? {}))) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/projects', async (request: FastifyRequest<{ Querystring: { keyword?: string; role?: string; skills?: string; ownedBy?: string } }>, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const skills = request.query.skills?.split(',').map((skill) => skill.trim()).filter(Boolean) ?? [];
    return { projects: await store.listProjects({ keyword: request.query.keyword, role: request.query.role, skills, ownedBy: request.query.ownedBy }, userId) };
  });

  app.post('/api/projects', async (request: BodyRequest<Omit<CreateProjectInput, 'ownerId'>>, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      const body = request.body;
      if (!body?.title?.trim() || !body.goal?.trim() || !body.progress?.trim() || !body.expectedOutcome?.trim() || !Array.isArray(body.roles) || body.roles.length === 0) throw new Error('INVALID_PROJECT');
      if (body.roles.some((role) => !role.name?.trim() || !Array.isArray(role.skills) || role.skills.length === 0 || !Number.isInteger(role.capacity) || role.capacity < 1)) throw new Error('INVALID_PROJECT');
      return { project: await store.createProject({ ...body, ownerId: userId }) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/projects/:id', async (request: IdRequest, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    const project = await store.getProject(request.params.id, userId);
    if (!project) return sendError(reply, new Error('PROJECT_NOT_FOUND'));
    return { project };
  });

  app.patch('/api/projects/:id/recruitment', async (request: FastifyRequest<{ Params: { id: string }; Body: { paused?: boolean } }>, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      if (typeof request.body?.paused !== 'boolean') throw new Error('INVALID_RECRUITMENT_STATUS');
      return { project: await store.setRecruitmentPaused(request.params.id, userId, request.body.paused) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/api/applications/mine', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    return { applications: await store.listMyApplications(userId) };
  });

  app.get('/api/projects/:id/applications', async (request: ProjectApplicationRequest, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      return { applications: await store.listProjectApplications(request.params.id, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/projects/:id/applications', async (request: FastifyRequest<{ Params: { id: string }; Body: Omit<CreateApplicationInput, 'projectId' | 'applicantId'> }>, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      const body = request.body;
      if (!body?.roleId || !body.reason?.trim() || !body.contribution?.trim()) throw new Error('INVALID_APPLICATION');
      return reply.code(201).send({ application: await store.createApplication({ ...body, projectId: request.params.id, applicantId: userId }) });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/applications/:id/withdraw', async (request: IdRequest, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      return { application: await store.withdrawApplication(request.params.id, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/applications/:id/approve', async (request: IdRequest, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      return { result: await store.approveApplication(request.params.id, userId) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/api/applications/:id/reject', async (request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;
    try {
      const reason = String(request.body?.reason ?? '').trim();
      if (!reason) throw new Error('REJECTION_REASON_REQUIRED');
      return { application: await store.rejectApplication(request.params.id, userId, reason) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  return app;
}

function publicUser(user: { id: string; username: string; nickname: string; bio: string; skills: string[]; weeklyHours: number }) {
  return { id: user.id, username: user.username, nickname: user.nickname, bio: user.bio, skills: user.skills, weeklyHours: user.weeklyHours };
}
