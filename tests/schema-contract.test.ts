import { describe, expect, it } from 'vitest';
import { createDemoStore } from '../server/memory-store';

describe('demo fixtures', () => {
  it('contains four users and open, paused, and full project states', async () => {
    const store = createDemoStore();
    const projects = await store.listProjects({}, 'user_b');
    expect(projects).toHaveLength(3);
    expect(projects.find((project) => project.id === 'project_paused')?.recruitmentPaused).toBe(true);
    expect(projects.find((project) => project.id === 'project_full')?.allRolesFull).toBe(true);
    expect(projects.find((project) => project.id === 'project_open')?.roles.find((role) => role.id === 'role_open_frontend')).toMatchObject({ capacity: 1, joinedCount: 0, remaining: 1 });
    expect((await store.listProjectApplications('project_open', 'user_a'))).toHaveLength(2);
  });
});
