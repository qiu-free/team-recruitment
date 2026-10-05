import type { Project, ProjectRole } from '../types';

export type FilterableProject = Project & { roles: ProjectRole[] };

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function filterProjects<T extends FilterableProject>(projects: T[], filters: {
  keyword?: string;
  role?: string;
  skills?: string[];
}): T[] {
  const keyword = normalized(filters.keyword ?? '');
  const role = normalized(filters.role ?? '');
  const skills = (filters.skills ?? []).map(normalized).filter(Boolean);

  return projects.filter((project) => {
    const keywordMatch = !keyword || [project.title, project.goal, project.progress, project.expectedOutcome]
      .some((field) => normalized(field).includes(keyword));
    if (!keywordMatch) return false;

    return project.roles.some((candidate) => {
      const roleMatch = !role || normalized(candidate.name).includes(role);
      const skillMatch = skills.every((required) => candidate.skills.some((skill) => normalized(skill).includes(required)));
      return roleMatch && skillMatch;
    });
  });
}

export function remainingCapacity(role: ProjectRole, members: Array<{ roleId: string | null }>): number {
  return Math.max(0, role.capacity - members.filter((member) => member.roleId === role.id).length);
}
