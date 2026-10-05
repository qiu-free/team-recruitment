import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { withTransaction } from './db';
import { hashPassword, newId, now } from './security';
import { filterProjects } from './domain/rules';
import type {
  Application, CreateApplicationInput, CreateProjectInput, Profile, Project, ProjectDetail,
  ProjectFilters, ProjectMember, ProjectRole, ProjectSummary, Store, User
} from './types';

type DbUser = {
  id: string; username: string; password_hash: string; nickname: string; bio: string;
  skills: string[]; weekly_hours: number;
};
type DbProject = {
  id: string; owner_id: string; title: string; goal: string; progress: string;
  expected_outcome: string; recruitment_paused: boolean; created_at: Date | string;
};
type DbRole = { id: string; project_id: string; name: string; skills: string[]; capacity: number };
type DbMember = { id: string; project_id: string; user_id: string; role_id: string | null; is_owner: boolean; joined_at: Date | string };
type DbApplication = {
  id: string; project_id: string; applicant_id: string; role_id: string; reason: string;
  contribution: string; profile_snapshot: Profile; status: Application['status'];
  rejection_reason: string | null; reviewed_at: Date | string | null; created_at: Date | string;
};

function asString(value: Date | string | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function user(row: DbUser): User {
  return { id: row.id, username: row.username, passwordHash: row.password_hash, nickname: row.nickname, bio: row.bio, skills: row.skills ?? [], weeklyHours: row.weekly_hours };
}

function project(row: DbProject): Project {
  return { id: row.id, ownerId: row.owner_id, title: row.title, goal: row.goal, progress: row.progress, expectedOutcome: row.expected_outcome, recruitmentPaused: row.recruitment_paused, createdAt: asString(row.created_at)! };
}

function role(row: DbRole): ProjectRole {
  return { id: row.id, projectId: row.project_id, name: row.name, skills: row.skills ?? [], capacity: row.capacity };
}

function member(row: DbMember): ProjectMember {
  return { id: row.id, projectId: row.project_id, userId: row.user_id, roleId: row.role_id, isOwner: row.is_owner, joinedAt: asString(row.joined_at)! };
}

function application(row: DbApplication): Application {
  return { id: row.id, projectId: row.project_id, applicantId: row.applicant_id, roleId: row.role_id, reason: row.reason, contribution: row.contribution, profileSnapshot: row.profile_snapshot, status: row.status, rejectionReason: row.rejection_reason, reviewedAt: asString(row.reviewed_at), createdAt: asString(row.created_at)! };
}

async function one<T extends QueryResultRow>(client: Pool | PoolClient, text: string, values: unknown[]): Promise<T | null> {
  const result = await client.query<T>(text, values);
  return result.rows[0] ?? null;
}

export class PostgresStore implements Store {
  constructor(public readonly pool: Pool) {}

  async getUserById(id: string) {
    const row = await one<DbUser>(this.pool, 'SELECT * FROM users WHERE id = $1', [id]);
    return row ? user(row) : null;
  }

  async getUserByUsername(username: string) {
    const row = await one<DbUser>(this.pool, 'SELECT * FROM users WHERE username = $1', [username]);
    return row ? user(row) : null;
  }

  async updateProfile(id: string, profile: Profile) {
    const row = await one<DbUser>(this.pool, `UPDATE users SET nickname = $2, bio = $3, skills = $4::jsonb, weekly_hours = $5, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, profile.nickname, profile.bio, JSON.stringify(profile.skills), profile.weeklyHours]);
    if (!row) throw new Error('USER_NOT_FOUND');
    return user(row);
  }

  private async makeSummary(client: Pool | PoolClient, row: DbProject, viewerId: string): Promise<ProjectSummary> {
    const projectEntity = project(row);
    const ownerRow = await one<DbUser>(client, 'SELECT * FROM users WHERE id = $1', [projectEntity.ownerId]);
    const roleRows = (await client.query<DbRole>('SELECT * FROM project_roles WHERE project_id = $1 ORDER BY id', [projectEntity.id])).rows;
    const memberRows = (await client.query<DbMember>('SELECT * FROM project_members WHERE project_id = $1', [projectEntity.id])).rows;
    const roles = roleRows.map((candidate) => {
      const current = memberRows.filter((memberRow) => memberRow.role_id === candidate.id).length;
      return { ...role(candidate), joinedCount: current, remaining: Math.max(0, candidate.capacity - current) };
    });
    return { ...projectEntity, owner: { id: ownerRow!.id, username: ownerRow!.username, nickname: ownerRow!.nickname }, roles, memberCount: memberRows.length, allRolesFull: roles.length > 0 && roles.every((candidate) => candidate.remaining === 0), isOwner: projectEntity.ownerId === viewerId };
  }

  async listProjects(filters: ProjectFilters, viewerId: string) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (filters.ownedBy) { values.push(filters.ownedBy); conditions.push(`owner_id = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (await this.pool.query<DbProject>(`SELECT * FROM projects ${where} ORDER BY created_at DESC`, values)).rows;
    const summaries = await Promise.all(rows.map((row) => this.makeSummary(this.pool, row, viewerId)));
    if (!filters.keyword && !filters.role && !(filters.skills?.length)) return summaries;
    return filterProjects(summaries.map((summary) => ({ ...summary, roles: summary.roles })), filters).map((summary) => summary);
  }

  async getProject(id: string, viewerId: string) {
    const row = await one<DbProject>(this.pool, 'SELECT * FROM projects WHERE id = $1', [id]);
    if (!row) return null;
    const summary = await this.makeSummary(this.pool, row, viewerId);
    const memberRows = (await this.pool.query<DbMember>('SELECT * FROM project_members WHERE project_id = $1 ORDER BY joined_at', [id])).rows;
    const members = await Promise.all(memberRows.map(async (memberRow) => {
      const userRow = await one<DbUser>(this.pool, 'SELECT id, username, nickname, bio, skills, weekly_hours, password_hash FROM users WHERE id = $1', [memberRow.user_id]);
      return { ...member(memberRow), user: { id: userRow!.id, username: userRow!.username, nickname: userRow!.nickname, skills: userRow!.skills ?? [] } };
    }));
    const applicationsQuery = summary.isOwner ? 'SELECT * FROM applications WHERE project_id = $1 ORDER BY created_at' : 'SELECT * FROM applications WHERE project_id = $1 AND applicant_id = $2 ORDER BY created_at';
    const applicationRows = (await this.pool.query<DbApplication>(applicationsQuery, summary.isOwner ? [id] : [id, viewerId])).rows;
    const ownerRow = await one<DbUser>(this.pool, 'SELECT * FROM users WHERE id = $1', [row.owner_id]);
    return { ...summary, ownerProfile: { nickname: ownerRow!.nickname, bio: ownerRow!.bio, skills: ownerRow!.skills ?? [], weeklyHours: ownerRow!.weekly_hours }, members, applications: applicationRows.map(application) } satisfies ProjectDetail;
  }

  async createProject(input: CreateProjectInput) {
    return withTransaction(this.pool, async (client) => {
      const createdAt = now();
      const projectId = newId('project');
      await client.query('INSERT INTO projects (id, owner_id, title, goal, progress, expected_outcome, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [projectId, input.ownerId, input.title, input.goal, input.progress, input.expectedOutcome, createdAt]);
      await client.query('INSERT INTO project_members (id, project_id, user_id, is_owner, joined_at) VALUES ($1, $2, $3, TRUE, $4)', [newId('member'), projectId, input.ownerId, createdAt]);
      for (const inputRole of input.roles) await client.query('INSERT INTO project_roles (id, project_id, name, skills, capacity) VALUES ($1, $2, $3, $4::jsonb, $5)', [newId('role'), projectId, inputRole.name, JSON.stringify(inputRole.skills), inputRole.capacity]);
      const created = await one<DbProject>(client, 'SELECT * FROM projects WHERE id = $1', [projectId]);
      return this.makeSummary(client, created!, input.ownerId).then(async (summary) => ({ ...summary, ownerProfile: (await this.getUserById(input.ownerId))!, members: [], applications: [] }));
    }) as Promise<ProjectDetail>;
  }

  async setRecruitmentPaused(projectId: string, ownerId: string, paused: boolean) {
    const row = await one<DbProject>(this.pool, 'UPDATE projects SET recruitment_paused = $3 WHERE id = $1 AND owner_id = $2 RETURNING *', [projectId, ownerId, paused]);
    if (!row) {
      const exists = await one<{ id: string }>(this.pool, 'SELECT id FROM projects WHERE id = $1', [projectId]);
      throw new Error(exists ? 'FORBIDDEN' : 'PROJECT_NOT_FOUND');
    }
    return project(row);
  }

  async listMyApplications(applicantId: string) {
    const rows = (await this.pool.query<DbApplication>('SELECT * FROM applications WHERE applicant_id = $1 ORDER BY created_at DESC', [applicantId])).rows;
    return rows.map(application);
  }

  async listProjectApplications(projectId: string, ownerId: string) {
    const owner = await one<{ owner_id: string }>(this.pool, 'SELECT owner_id FROM projects WHERE id = $1', [projectId]);
    if (!owner) throw new Error('PROJECT_NOT_FOUND');
    if (owner.owner_id !== ownerId) throw new Error('FORBIDDEN');
    return (await this.pool.query<DbApplication>('SELECT * FROM applications WHERE project_id = $1 ORDER BY created_at', [projectId])).rows.map(application);
  }

  async createApplication(input: CreateApplicationInput) {
    return withTransaction(this.pool, async (client) => {
      const project = await one<DbProject>(client, 'SELECT * FROM projects WHERE id = $1 FOR UPDATE', [input.projectId]);
      const roleRow = await one<DbRole>(client, 'SELECT * FROM project_roles WHERE id = $1 AND project_id = $2 FOR UPDATE', [input.roleId, input.projectId]);
      if (!project || !roleRow) throw new Error('NOT_FOUND');
      if (project.owner_id === input.applicantId) throw new Error('OWNER_CANNOT_APPLY');
      if (project.recruitment_paused) throw new Error('RECRUITMENT_PAUSED');
      const memberExists = await one<{ id: string }>(client, 'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2', [input.projectId, input.applicantId]);
      if (memberExists) throw new Error('ALREADY_MEMBER');
      const pending = await one<{ id: string }>(client, `SELECT id FROM applications WHERE project_id = $1 AND applicant_id = $2 AND status = 'pending' FOR UPDATE`, [input.projectId, input.applicantId]);
      if (pending) throw new Error('PENDING_APPLICATION_EXISTS');
      const count = await one<{ count: string }>(client, 'SELECT COUNT(*)::text AS count FROM project_members WHERE project_id = $1 AND role_id = $2', [input.projectId, input.roleId]);
      if (Number(count!.count) >= roleRow.capacity) throw new Error('ROLE_FULL');
      const applicant = await one<DbUser>(client, 'SELECT * FROM users WHERE id = $1', [input.applicantId]);
      if (!applicant) throw new Error('USER_NOT_FOUND');
      const id = newId('application');
      const createdAt = now();
      const snapshot: Profile = { nickname: applicant.nickname, bio: applicant.bio, skills: applicant.skills ?? [], weeklyHours: applicant.weekly_hours };
      const row = await one<DbApplication>(client, 'INSERT INTO applications (id, project_id, applicant_id, role_id, reason, contribution, profile_snapshot, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, \'pending\', $8) RETURNING *', [id, input.projectId, input.applicantId, input.roleId, input.reason, input.contribution, JSON.stringify(snapshot), createdAt]);
      return application(row!);
    });
  }

  async withdrawApplication(applicationId: string, applicantId: string) {
    const row = await one<DbApplication>(this.pool, `UPDATE applications SET status = 'withdrawn', reviewed_at = NOW() WHERE id = $1 AND applicant_id = $2 AND status = 'pending' RETURNING *`, [applicationId, applicantId]);
    if (row) return application(row);
    const exists = await one<DbApplication>(this.pool, 'SELECT * FROM applications WHERE id = $1', [applicationId]);
    if (!exists) throw new Error('NOT_FOUND');
    if (exists.applicant_id !== applicantId) throw new Error('FORBIDDEN');
    throw new Error('APPLICATION_ALREADY_PROCESSED');
  }

  async approveApplication(applicationId: string, ownerId: string) {
    return withTransaction(this.pool, async (client) => {
      const row = await one<DbApplication>(client, 'SELECT * FROM applications WHERE id = $1 FOR UPDATE', [applicationId]);
      if (!row) throw new Error('NOT_FOUND');
      const project = await one<DbProject>(client, 'SELECT * FROM projects WHERE id = $1', [row.project_id]);
      if (!project) throw new Error('PROJECT_NOT_FOUND');
      if (project.owner_id !== ownerId) throw new Error('FORBIDDEN');
      if (row.status === 'approved') {
        const existing = await one<DbMember>(client, 'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2', [row.project_id, row.applicant_id]);
        if (!existing) throw new Error('INCONSISTENT_APPROVAL');
        return { application: application(row), member: member(existing), alreadyProcessed: true };
      }
      if (row.status !== 'pending') throw new Error('APPLICATION_ALREADY_PROCESSED');
      const roleRow = await one<DbRole>(client, 'SELECT * FROM project_roles WHERE id = $1 FOR UPDATE', [row.role_id]);
      if (!roleRow) throw new Error('NOT_FOUND');
      const existing = await one<DbMember>(client, 'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2', [row.project_id, row.applicant_id]);
      if (existing) throw new Error('ALREADY_MEMBER');
      const count = await one<{ count: string }>(client, 'SELECT COUNT(*)::text AS count FROM project_members WHERE project_id = $1 AND role_id = $2', [row.project_id, row.role_id]);
      if (Number(count!.count) >= roleRow.capacity) throw new Error('ROLE_FULL');
      const reviewedAt = now();
      const updated = await one<DbApplication>(client, `UPDATE applications SET status = 'approved', reviewed_at = $2 WHERE id = $1 RETURNING *`, [row.id, reviewedAt]);
      const memberRow = await one<DbMember>(client, 'INSERT INTO project_members (id, project_id, user_id, role_id, is_owner, joined_at) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING *', [newId('member'), row.project_id, row.applicant_id, row.role_id, reviewedAt]);
      return { application: application(updated!), member: member(memberRow!) };
    });
  }

  async rejectApplication(applicationId: string, ownerId: string, reason: string) {
    return withTransaction(this.pool, async (client) => {
      const row = await one<DbApplication>(client, 'SELECT * FROM applications WHERE id = $1 FOR UPDATE', [applicationId]);
      if (!row) throw new Error('NOT_FOUND');
      const project = await one<DbProject>(client, 'SELECT * FROM projects WHERE id = $1', [row.project_id]);
      if (!project) throw new Error('PROJECT_NOT_FOUND');
      if (project.owner_id !== ownerId) throw new Error('FORBIDDEN');
      if (row.status !== 'pending') throw new Error('APPLICATION_ALREADY_PROCESSED');
      const updated = await one<DbApplication>(client, `UPDATE applications SET status = 'rejected', rejection_reason = $2, reviewed_at = NOW() WHERE id = $1 RETURNING *`, [applicationId, reason]);
      return application(updated!);
    });
  }
}
