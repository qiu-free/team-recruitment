import { describe, expect, it } from 'vitest';
import { filterProjects, remainingCapacity } from '../server/domain/rules';

describe('project filtering rules', () => {
  const projects = [
    { id: 'p1', ownerId: 'u1', title: '校园看板', goal: '展示校园数据', progress: '', expectedOutcome: '', recruitmentPaused: false, createdAt: '', roles: [
      { id: 'r1', projectId: 'p1', name: '前端', skills: ['React', 'TypeScript'], capacity: 1 },
      { id: 'r2', projectId: 'p1', name: '测试', skills: ['Python'], capacity: 1 }
    ] }
  ];

  it('matches role and all skills on the same role', () => {
    expect(filterProjects(projects, { role: '前端', skills: ['React', 'TypeScript'] })).toHaveLength(1);
    expect(filterProjects(projects, { role: '前端', skills: ['Python'] })).toHaveLength(0);
  });

  it('matches normalized skill labels without treating a different label as a match', () => {
    const withReactNative = [{ ...projects[0], roles: [{ ...projects[0].roles[0], skills: ['React Native'] }] }];
    expect(filterProjects(withReactNative, { skills: ['React'] })).toHaveLength(0);
  });

  it('calculates remaining capacity without counting the owner', () => {
    expect(remainingCapacity(projects[0].roles[0], [{ roleId: null }])).toBe(1);
    expect(remainingCapacity(projects[0].roles[0], [{ roleId: null }, { roleId: 'r1' }])).toBe(0);
  });
});
