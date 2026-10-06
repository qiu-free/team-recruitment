export type AppOptions = {
  database?: boolean;
  store?: Store;
};

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type Profile = {
  nickname: string;
  bio: string;
  skills: string[];
  weeklyHours: number;
};

export type User = Profile & {
  id: string;
  username: string;
  passwordHash: string;
  sessionVersion: number;
};

export type Project = {
  id: string;
  ownerId: string;
  title: string;
  goal: string;
  progress: string;
  expectedOutcome: string;
  recruitmentPaused: boolean;
  createdAt: string;
};

export type ProjectRole = {
  id: string;
  projectId: string;
  name: string;
  skills: string[];
  capacity: number;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  roleId: string | null;
  isOwner: boolean;
  joinedAt: string;
};

export type Application = {
  id: string;
  projectId: string;
  applicantId: string;
  roleId: string;
  reason: string;
  contribution: string;
  profileSnapshot: Profile;
  status: ApplicationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  projectTitle?: string;
  roleName?: string;
};

export type ProjectFilters = {
  keyword?: string;
  role?: string;
  skills?: string[];
  ownedBy?: string;
};

export type RoleView = ProjectRole & {
  joinedCount: number;
  remaining: number;
};

export type ProjectSummary = Project & {
  owner: Pick<User, 'id' | 'username' | 'nickname'>;
  roles: RoleView[];
  memberCount: number;
  allRolesFull: boolean;
  isOwner: boolean;
};

export type ProjectDetail = ProjectSummary & {
  ownerProfile: Profile;
  members: Array<ProjectMember & { user: Pick<User, 'id' | 'username' | 'nickname' | 'skills'> }>;
  applications: Application[];
};

export type CreateProjectInput = {
  ownerId: string;
  title: string;
  goal: string;
  progress: string;
  expectedOutcome: string;
  roles: Array<{ name: string; skills: string[]; capacity: number }>;
};

export type CreateApplicationInput = {
  projectId: string;
  applicantId: string;
  roleId: string;
  reason: string;
  contribution: string;
};

export type Store = {
  getUserById(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  updateProfile(id: string, profile: Profile): Promise<User>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  invalidateSessions(id: string): Promise<void>;
  listProjects(filters: ProjectFilters, viewerId: string): Promise<ProjectSummary[]>;
  getProject(id: string, viewerId: string): Promise<ProjectDetail | null>;
  createProject(input: CreateProjectInput): Promise<ProjectDetail>;
  setRecruitmentPaused(projectId: string, ownerId: string, paused: boolean): Promise<Project>;
  listMyApplications(applicantId: string): Promise<Application[]>;
  listProjectApplications(projectId: string, ownerId: string): Promise<Application[]>;
  createApplication(input: CreateApplicationInput): Promise<Application>;
  withdrawApplication(applicationId: string, applicantId: string): Promise<Application>;
  approveApplication(applicationId: string, ownerId: string): Promise<{ application: Application; member: ProjectMember; alreadyProcessed?: boolean }>;
  rejectApplication(applicationId: string, ownerId: string, reason: string): Promise<Application>;
};
