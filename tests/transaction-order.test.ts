import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('database transaction lock order', () => {
  it('locks project before application in approval transactions', () => {
    const source = readFileSync(new URL('../server/postgres-store.ts', import.meta.url), 'utf8');
    const approve = source.slice(source.indexOf('async approveApplication'));
    expect(approve.indexOf("SELECT project_id, role_id FROM applications WHERE id = $1")).toBeGreaterThanOrEqual(0);
    expect(approve.indexOf("SELECT * FROM projects WHERE id = $1 FOR UPDATE")).toBeLessThan(approve.indexOf("SELECT * FROM applications WHERE id = $1 FOR UPDATE"));
    expect(approve.indexOf("SELECT * FROM project_roles WHERE id = $1 AND project_id = $2 FOR UPDATE")).toBeLessThan(approve.indexOf("SELECT * FROM applications WHERE id = $1 FOR UPDATE"));
  });
});
