export type Profile = {
  nickname: string;
  bio: string;
  skills: string[];
  weeklyHours: number;
};

export type User = Profile & {
  id: string;
  username: string;
};

export type Role = {
  id: string;
  name: string;
  skills: string[];
  capacity: number;
  joinedCount: number;
  remaining: number;
};

export type Project = {
  id: string;
  ownerId: string;
  title: string;
  goal: string;
  progress: string;
  expectedOutcome: string;
  recruitmentPaused: boolean;
  owner: Pick<User, 'id' | 'username' | 'nickname'>;
  roles: Role[];
  memberCount: number;
  allRolesFull: boolean;
  isOwner: boolean;
};

export type Application = {
  id: string;
  projectId: string;
  applicantId: string;
  roleId: string;
  reason: string;
  contribution: string;
  profileSnapshot: {
    nickname: string;
    bio: string;
    skills: string[];
    weeklyHours: number;
  };
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejectionReason: string | null;
  createdAt: string;
  projectTitle?: string;
  roleName?: string;
};

export type ProjectDetail = Project & {
  ownerProfile: Profile;
  members: Array<{
    id: string;
    userId: string;
    roleId: string | null;
    isOwner: boolean;
    user: Pick<User, 'id' | 'username' | 'nickname' | 'skills'>;
  }>;
  applications: Application[];
};

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${url}`, {
    credentials: 'include',
    headers,
    ...init
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? 'REQUEST_FAILED', body.message ?? '请求失败');
  }
  return body as T;
}

export const api = {
  login: (username: string, password: string) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),
  updateProfile: (profile: Omit<User, 'id' | 'username'>) => request<{ profile: User }>('/profile', { method: 'PATCH', body: JSON.stringify(profile) }),
  projects: (filters: { keyword?: string; role?: string; skills?: string[]; ownedBy?: string }) => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.role) params.set('role', filters.role);
    if (filters.skills?.length) params.set('skills', filters.skills.join(','));
    if (filters.ownedBy) params.set('ownedBy', filters.ownedBy);
    return request<{ projects: Project[] }>(`/projects?${params}`);
  },
  project: (id: string) => request<{ project: ProjectDetail }>(`/projects/${id}`),
  createProject: (project: { title: string; goal: string; progress: string; expectedOutcome: string; roles: Array<{ name: string; skills: string[]; capacity: number }> }) => request<{ project: ProjectDetail }>('/projects', { method: 'POST', body: JSON.stringify(project) }),
  setPaused: (id: string, paused: boolean) => request<{ project: Project }>(`/projects/${id}/recruitment`, { method: 'PATCH', body: JSON.stringify({ paused }) }),
  applications: () => request<{ applications: Application[] }>('/applications/mine'),
  createApplication: (projectId: string, application: { roleId: string; reason: string; contribution: string }) => request<{ application: Application }>(`/projects/${projectId}/applications`, { method: 'POST', body: JSON.stringify(application) }),
  withdraw: (id: string) => request<{ application: Application }>(`/applications/${id}/withdraw`, { method: 'POST' }),
  approve: (id: string) => request<{ result: { application: Application; alreadyProcessed?: boolean } }>(`/applications/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) => request<{ application: Application }>(`/applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
};
