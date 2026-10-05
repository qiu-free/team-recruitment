import type {
  Application, CreateApplicationInput, CreateProjectInput, Profile, Project, ProjectDetail,
  ProjectFilters, ProjectMember, ProjectRole, ProjectSummary, Store, User
} from './types';
import { filterProjects, remainingCapacity } from './domain/rules';
import { hashPassword, newId, now } from './security';

function profile(nickname: string, bio: string, skills: string[], weeklyHours: number): Profile {
  return { nickname, bio, skills, weeklyHours };
}

function demoUser(id: string, username: string, data: Profile): User {
  return { id, username, passwordHash: hashPassword('demo1234'), ...data };
}

export function createDemoStore(): MemoryStore {
  const users: User[] = [
    demoUser('user_a', 'alice', profile('林知夏', '喜欢把模糊想法做成可以使用的产品。', ['产品设计', '用户研究', '项目管理'], 10)),
    demoUser('user_b', 'bob', profile('周予安', '前端开发学习者，喜欢把复杂交互做得简单。', ['React', 'TypeScript', 'Web 开发'], 8)),
    demoUser('user_c', 'cathy', profile('许清禾', '正在积累数据可视化和测试实践。', ['Python', '数据可视化', '测试'], 6)),
    demoUser('user_d', 'david', profile('陈默', '希望参与真实项目，负责落地和文档。', ['Node.js', 'PostgreSQL', '文档'], 5))
  ];
  const projects: Project[] = [
    { id: 'project_open', ownerId: 'user_a', title: '校园智能导览', goal: '为新生制作一个更容易理解的校园路线与服务地图。', progress: '已完成用户访谈，正在制作第一版原型。', expectedOutcome: '可交互原型和一份用户测试报告。', recruitmentPaused: false, createdAt: '2026-09-10T08:00:00.000Z' },
    { id: 'project_paused', ownerId: 'user_a', title: '绿色校园能耗看板', goal: '用可视化方式帮助同学理解校园能源使用。', progress: '数据字段已经整理，等待招募恢复后开始开发。', expectedOutcome: '一套可演示的能耗分析看板。', recruitmentPaused: true, createdAt: '2026-09-12T08:00:00.000Z' },
    { id: 'project_full', ownerId: 'user_d', title: '社团活动协作台', goal: '让社团负责人可以快速分配活动准备工作。', progress: '核心功能已完成，正在补充测试。', expectedOutcome: '可部署的活动协作工具。', recruitmentPaused: false, createdAt: '2026-09-14T08:00:00.000Z' }
  ];
  const roles: ProjectRole[] = [
    { id: 'role_open_frontend', projectId: 'project_open', name: '前端开发', skills: ['React', 'TypeScript', 'Web 开发'], capacity: 1 },
    { id: 'role_open_research', projectId: 'project_open', name: '用户研究', skills: ['用户研究', '访谈'], capacity: 2 },
    { id: 'role_paused_data', projectId: 'project_paused', name: '数据可视化', skills: ['Python', '数据可视化'], capacity: 2 },
    { id: 'role_full_backend', projectId: 'project_full', name: '后端开发', skills: ['Node.js', 'PostgreSQL'], capacity: 1 }
  ];
  const members: ProjectMember[] = [
    { id: 'member_owner_open', projectId: 'project_open', userId: 'user_a', roleId: null, isOwner: true, joinedAt: '2026-09-10T08:00:00.000Z' },
    { id: 'member_owner_paused', projectId: 'project_paused', userId: 'user_a', roleId: null, isOwner: true, joinedAt: '2026-09-12T08:00:00.000Z' },
    { id: 'member_owner_full', projectId: 'project_full', userId: 'user_d', roleId: null, isOwner: true, joinedAt: '2026-09-14T08:00:00.000Z' },
    { id: 'member_full_backend', projectId: 'project_full', userId: 'user_b', roleId: 'role_full_backend', isOwner: false, joinedAt: '2026-09-20T08:00:00.000Z' }
  ];
  const applications: Application[] = [
    { id: 'application_b_open', projectId: 'project_open', applicantId: 'user_b', roleId: 'role_open_frontend', reason: '我有 React 和 TypeScript 课程项目经验。', contribution: '负责首页、角色卡片和移动端适配。', profileSnapshot: profile('周予安', '前端开发学习者，喜欢把复杂交互做得简单。', ['React', 'TypeScript', 'Web 开发'], 8), status: 'pending', rejectionReason: null, reviewedAt: null, createdAt: '2026-09-22T08:00:00.000Z' },
    { id: 'application_c_open', projectId: 'project_open', applicantId: 'user_c', roleId: 'role_open_frontend', reason: '我正在学习前端，也能负责可视化部分。', contribution: '协助数据展示组件和测试用例。', profileSnapshot: profile('许清禾', '正在积累数据可视化和测试实践。', ['Python', '数据可视化', '测试'], 6), status: 'pending', rejectionReason: null, reviewedAt: null, createdAt: '2026-09-23T08:00:00.000Z' }
  ];
  return new MemoryStore(users, projects, roles, members, applications);
}

export class MemoryStore implements Store {
  constructor(
    private readonly users: User[],
    private readonly projects: Project[],
    private readonly roles: ProjectRole[],
    private readonly members: ProjectMember[],
    private readonly applications: Application[]
  ) {}

  async getUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async getUserByUsername(username: string) { return this.users.find((user) => user.username === username) ?? null; }

  async updateProfile(id: string, input: Profile) {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) throw new Error('USER_NOT_FOUND');
    Object.assign(user, input);
    return user;
  }

  private projectSummary(project: Project, viewerId: string): ProjectSummary {
    const owner = this.users.find((user) => user.id === project.ownerId)!;
    const projectRoles = this.roles.filter((role) => role.projectId === project.id);
    const projectMembers = this.members.filter((member) => member.projectId === project.id);
    const roles = projectRoles.map((role) => ({ ...role, joinedCount: projectMembers.filter((member) => member.roleId === role.id).length, remaining: remainingCapacity(role, projectMembers) }));
    return { ...project, owner: { id: owner.id, username: owner.username, nickname: owner.nickname }, roles, memberCount: projectMembers.length, allRolesFull: roles.length > 0 && roles.every((role) => role.remaining === 0), isOwner: project.ownerId === viewerId };
  }

  async listProjects(filters: ProjectFilters, viewerId: string) {
    const candidates = this.projects.filter((project) => !filters.ownedBy || project.ownerId === filters.ownedBy).map((project) => ({ ...project, roles: this.roles.filter((role) => role.projectId === project.id) }));
    return filterProjects(candidates, { keyword: filters.keyword, role: filters.role, skills: filters.skills }).map((project) => this.projectSummary(project, viewerId));
  }

  async getProject(id: string, viewerId: string) {
    const project = this.projects.find((candidate) => candidate.id === id);
    if (!project) return null;
    const summary = this.projectSummary(project, viewerId);
    const projectMembers = this.members.filter((member) => member.projectId === id);
    const members = projectMembers.map((member) => {
      const user = this.users.find((candidate) => candidate.id === member.userId)!;
      return { ...member, user: { id: user.id, username: user.username, nickname: user.nickname, skills: user.skills } };
    });
    const applications = project.ownerId === viewerId ? this.applications.filter((application) => application.projectId === id) : this.applications.filter((application) => application.projectId === id && application.applicantId === viewerId);
    const ownerUser = this.users.find((user) => user.id === project.ownerId)!;
    return { ...summary, ownerProfile: { nickname: ownerUser.nickname, bio: ownerUser.bio, skills: ownerUser.skills, weeklyHours: ownerUser.weeklyHours }, members, applications };
  }

  async createProject(input: CreateProjectInput) {
    const project: Project = { id: newId('project'), ownerId: input.ownerId, title: input.title, goal: input.goal, progress: input.progress, expectedOutcome: input.expectedOutcome, recruitmentPaused: false, createdAt: now() };
    this.projects.push(project);
    this.members.push({ id: newId('member'), projectId: project.id, userId: input.ownerId, roleId: null, isOwner: true, joinedAt: project.createdAt });
    input.roles.forEach((inputRole) => this.roles.push({ id: newId('role'), projectId: project.id, name: inputRole.name, skills: inputRole.skills, capacity: inputRole.capacity }));
    return (await this.getProject(project.id, input.ownerId))!;
  }

  async setRecruitmentPaused(projectId: string, ownerId: string, paused: boolean) {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    if (project.ownerId !== ownerId) throw new Error('FORBIDDEN');
    project.recruitmentPaused = paused;
    return project;
  }

  async listMyApplications(applicantId: string) {
    return this.applications.filter((application) => application.applicantId === applicantId).map((application) => ({
      ...application,
      projectTitle: this.projects.find((project) => project.id === application.projectId)?.title,
      roleName: this.roles.find((role) => role.id === application.roleId)?.name
    }));
  }

  async listProjectApplications(projectId: string, ownerId: string) {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    if (project.ownerId !== ownerId) throw new Error('FORBIDDEN');
    return this.applications.filter((application) => application.projectId === projectId);
  }

  async createApplication(input: CreateApplicationInput) {
    const project = this.projects.find((candidate) => candidate.id === input.projectId);
    const role = this.roles.find((candidate) => candidate.id === input.roleId && candidate.projectId === input.projectId);
    if (!project || !role) throw new Error('NOT_FOUND');
    if (project.ownerId === input.applicantId) throw new Error('OWNER_CANNOT_APPLY');
    if (project.recruitmentPaused) throw new Error('RECRUITMENT_PAUSED');
    if (this.members.some((member) => member.projectId === project.id && member.userId === input.applicantId)) throw new Error('ALREADY_MEMBER');
    if (this.applications.some((application) => application.projectId === project.id && application.applicantId === input.applicantId && application.status === 'pending')) throw new Error('PENDING_APPLICATION_EXISTS');
    if (remainingCapacity(role, this.members.filter((member) => member.projectId === project.id)) === 0) throw new Error('ROLE_FULL');
    const user = this.users.find((candidate) => candidate.id === input.applicantId)!;
    const application: Application = { id: newId('application'), projectId: input.projectId, applicantId: input.applicantId, roleId: input.roleId, reason: input.reason, contribution: input.contribution, profileSnapshot: { nickname: user.nickname, bio: user.bio, skills: [...user.skills], weeklyHours: user.weeklyHours }, status: 'pending', rejectionReason: null, reviewedAt: null, createdAt: now() };
    this.applications.push(application);
    return application;
  }

  async withdrawApplication(applicationId: string, applicantId: string) {
    const application = this.applications.find((candidate) => candidate.id === applicationId);
    if (!application) throw new Error('NOT_FOUND');
    if (application.applicantId !== applicantId) throw new Error('FORBIDDEN');
    if (application.status !== 'pending') throw new Error('APPLICATION_ALREADY_PROCESSED');
    application.status = 'withdrawn';
    application.reviewedAt = now();
    return application;
  }

  async approveApplication(applicationId: string, ownerId: string) {
    const application = this.applications.find((candidate) => candidate.id === applicationId);
    if (!application) throw new Error('NOT_FOUND');
    const project = this.projects.find((candidate) => candidate.id === application.projectId)!;
    if (project.ownerId !== ownerId) throw new Error('FORBIDDEN');
    if (application.status === 'approved') {
      const member = this.members.find((candidate) => candidate.projectId === project.id && candidate.userId === application.applicantId)!;
      return { application, member, alreadyProcessed: true };
    }
    if (application.status !== 'pending') throw new Error('APPLICATION_ALREADY_PROCESSED');
    const role = this.roles.find((candidate) => candidate.id === application.roleId)!;
    if (remainingCapacity(role, this.members.filter((member) => member.projectId === project.id)) === 0) throw new Error('ROLE_FULL');
    if (this.members.some((member) => member.projectId === project.id && member.userId === application.applicantId)) throw new Error('ALREADY_MEMBER');
    application.status = 'approved';
    application.reviewedAt = now();
    const member: ProjectMember = { id: newId('member'), projectId: project.id, userId: application.applicantId, roleId: role.id, isOwner: false, joinedAt: application.reviewedAt };
    this.members.push(member);
    return { application, member };
  }

  async rejectApplication(applicationId: string, ownerId: string, reason: string) {
    const application = this.applications.find((candidate) => candidate.id === applicationId);
    if (!application) throw new Error('NOT_FOUND');
    const project = this.projects.find((candidate) => candidate.id === application.projectId)!;
    if (project.ownerId !== ownerId) throw new Error('FORBIDDEN');
    if (application.status !== 'pending') throw new Error('APPLICATION_ALREADY_PROCESSED');
    application.status = 'rejected';
    application.rejectionReason = reason;
    application.reviewedAt = now();
    return application;
  }
}
