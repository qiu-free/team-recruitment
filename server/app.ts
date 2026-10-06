import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppOptions, CreateApplicationInput, CreateProjectInput, Profile, Store } from './types';
import { createDemoStore } from './memory-store';
import { hashPassword, verifyPassword } from './security';

type BodyRequest<T> = FastifyRequest<{ Body: T }>;
type IdRequest = FastifyRequest<{ Params: { id: string } }>;
type ProjectApplicationRequest = FastifyRequest<{ Params: { id: string } }>;
type Session = { userId: string; sessionVersion: number };

const sessionCookie = 'team_session';

export function resolveClientRoot(): string {
  return join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist', 'client');
}

function errorStatus(code: string): number {
  if (code === 'UNAUTHORIZED') return 401;
  if (code === 'FORBIDDEN' || code === 'OWNER_CANNOT_APPLY' || code === 'RECRUITMENT_PAUSED') return 403;
  if (code === 'NOT_FOUND' || code === 'PROJECT_NOT_FOUND' || code === 'USER_NOT_FOUND') return 404;
  if (code === 'ROLE_FULL') return 409;
  if (code === 'PENDING_APPLICATION_EXISTS' || code === 'ALREADY_MEMBER' || code === 'APPLICATION_ALREADY_PROCESSED' || code === 'INCONSISTENT_APPROVAL') return 409;
  return 400;
}

function sendError(reply: FastifyReply, error: unknown) {
  const code = error instanceof Error ? error.message : 'BAD_REQUEST';
  const known = new Set([
    'FORBIDDEN', 'OWNER_CANNOT_APPLY', 'RECRUITMENT_PAUSED', 'NOT_FOUND', 'PROJECT_NOT_FOUND',
    'USER_NOT_FOUND', 'ROLE_FULL', 'PENDING_APPLICATION_EXISTS', 'ALREADY_MEMBER',
    'APPLICATION_ALREADY_PROCESSED', 'INCONSISTENT_APPROVAL', 'UNAUTHORIZED', 'INVALID_CREDENTIALS',
    'INVALID_PROFILE', 'INVALID_PROJECT', 'INVALID_APPLICATION', 'INVALID_RECRUITMENT_STATUS',
    'REJECTION_REASON_REQUIRED'
  ]);
  const safeCode = known.has(code) ? code : 'BAD_REQUEST';
  return reply.code(errorStatus(safeCode)).send({ error: safeCode, message: friendlyError(safeCode) });
}

function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    OWNER_CANNOT_APPLY: '项目发起人不能申请加入自己的项目。',
    RECRUITMENT_PAUSED: '项目目前暂停招募，暂不接收新申请。',
    ROLE_FULL: '该角色名额已满，请选择仍有余量的角色或稍后再试。',
    PENDING_APPLICATION_EXISTS: '你在本项目已有一条待审核申请。',
    ALREADY_MEMBER: '你已经是本项目成员。',
    APPLICATION_ALREADY_PROCESSED: '这条申请已经处理，不能重复操作。',
    FORBIDDEN: '你没有权限执行此操作。',
    UNAUTHORIZED: '请先登录。',
    INVALID_CREDENTIALS: '账号或密码错误。',
    INVALID_PROFILE: '个人资料格式不正确，请检查昵称、技能和每周时间。',
    INVALID_PROJECT: '项目内容不完整。',
    INVALID_APPLICATION: '请完整填写申请理由和可承担内容。',
    INVALID_RECRUITMENT_STATUS: '招募状态参数不正确。',
    REJECTION_REASON_REQUIRED: '请填写拒绝原因。',
    INCONSISTENT_APPROVAL: '申请与成员记录不一致，请刷新后重试。',
    USER_NOT_FOUND: '用户不存在。',
    PROJECT_NOT_FOUND: '项目不存在。',
    NOT_FOUND: '请求的数据不存在。'
  };
  return messages[code] ?? code;
}

const sessionLifetimeSeconds = 60 * 60 * 8;
const minimumSessionSecretLength = 32;

function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') return 'test-only-session-secret-please-do-not-use';
    throw new Error('SESSION_SECRET_REQUIRED');
  }
  if (secret.length < minimumSessionSecretLength) throw new Error('SESSION_SECRET_TOO_SHORT');
  return secret;
}

function signSession(userId: string, sessionVersion: number, expiresAt: number, secret: string): string {
  const payload = `${userId}.${sessionVersion}.${expiresAt}.${randomUUID()}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(token: string | undefined, secret: string): Session | undefined {
  if (!token) return undefined;
  const parts = token.split('.');
  if (parts.length !== 5) return undefined;
  const [userId, sessionVersionText, expiresAtText, sessionId, signature] = parts;
  if (!sessionId) return undefined;
  const sessionVersion = Number(sessionVersionText);
  const expiresAt = Number(expiresAtText);
  if (!userId || !Number.isInteger(sessionVersion) || sessionVersion < 0 || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return undefined;
  const expected = createHmac('sha256', secret).update(`${userId}.${sessionVersion}.${expiresAt}.${sessionId}`).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return undefined;
  return { userId, sessionVersion };
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
  if (!String(body.nickname ?? '').trim() || String(body.nickname).trim().length > 80 || String(body.bio ?? '').trim().length > 1000 || skills.length > 30 || skills.some((skill) => skill.length > 40) || !Number.isInteger(weeklyHours) || weeklyHours < 0 || weeklyHours > 168) throw new Error('INVALID_PROFILE');
  return { nickname: String(body.nickname).trim(), bio: String(body.bio ?? '').trim(), skills, weeklyHours };
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const secret = resolveSessionSecret();
  const app = Fastify({ logger: false });
  await app.register(cookie);
  const store: Store = options.store ?? createDemoStore();
  const clientRoot = resolveClientRoot();
  if (existsSync(clientRoot)) {
    await app.register(fastifyStatic, { root: clientRoot, wildcard: false });
  }

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[sessionCookie];
    const session = verifySession(token, secret);
    if (!session) return;
    const user = await store.getUserById(session.userId);
    if (user?.sessionVersion === session.sessionVersion) {
      (request as FastifyRequest & { userId?: string }).userId = user.id;
    }
  });

  app.get('/api/health', async () => ({ ok: true, service: 'team-recruitment' }));

  app.post('/api/auth/login', async (request: BodyRequest<{ username?: string; password?: string }>, reply) => {
    const username = String(request.body?.username ?? '').trim();
    const password = String(request.body?.password ?? '');
    const user = await store.getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) return sendError(reply, new Error('INVALID_CREDENTIALS'));
    const token = signSession(user.id, user.sessionVersion, Math.floor(Date.now() / 1000) + sessionLifetimeSeconds, secret);
    reply.setCookie(sessionCookie, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: sessionLifetimeSeconds });
    return { user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (userId) await store.invalidateSessions(userId);
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
      if (!body?.title?.trim() || body.title.trim().length > 120 || !body.goal?.trim() || body.goal.trim().length > 3000 || !body.progress?.trim() || body.progress.trim().length > 3000 || !body.expectedOutcome?.trim() || body.expectedOutcome.trim().length > 3000 || !Array.isArray(body.roles) || body.roles.length === 0 || body.roles.length > 30) throw new Error('INVALID_PROJECT');
      if (body.roles.some((role) => !role.name?.trim() || role.name.trim().length > 80 || !Array.isArray(role.skills) || role.skills.length === 0 || role.skills.length > 30 || role.skills.some((skill) => String(skill).trim().length === 0 || String(skill).trim().length > 40) || !Number.isInteger(role.capacity) || role.capacity < 1 || role.capacity > 999)) throw new Error('INVALID_PROJECT');
      return { project: await store.createProject({ title: body.title.trim(), goal: body.goal.trim(), progress: body.progress.trim(), expectedOutcome: body.expectedOutcome.trim(), roles: body.roles.map((role) => ({ name: role.name.trim(), skills: role.skills.map((skill) => String(skill).trim()).filter(Boolean), capacity: role.capacity })), ownerId: userId }) };
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
      if (!body?.roleId || body.roleId.length > 200 || !body.reason?.trim() || body.reason.trim().length > 2000 || !body.contribution?.trim() || body.contribution.trim().length > 2000) throw new Error('INVALID_APPLICATION');
      return reply.code(201).send({ application: await store.createApplication({ roleId: body.roleId, reason: body.reason.trim(), contribution: body.contribution.trim(), projectId: request.params.id, applicantId: userId }) });
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
      if (!reason || reason.length > 500) throw new Error('REJECTION_REASON_REQUIRED');
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
