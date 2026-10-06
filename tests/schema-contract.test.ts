import { describe, expect, it } from 'vitest';
import { createDemoStore } from '../server/memory-store';
import { readFileSync } from 'node:fs';

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

  it('declares database-level role ownership constraints', () => {
    const schema = readFileSync(new URL('../db/init/001_schema.sql', import.meta.url), 'utf8');
    expect(schema).toContain('UNIQUE(project_id, id)');
    expect(schema).toContain('FOREIGN KEY (project_id, role_id) REFERENCES project_roles(project_id, id)');
  });

  it('keeps the session version migration available for existing database volumes', () => {
    const migration = readFileSync(new URL('../db/init/003_session_version.sql', import.meta.url), 'utf8');
    const server = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS session_version');
    expect(server).toContain('ensureSessionVersionColumn');
  });
});
