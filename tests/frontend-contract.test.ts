import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('frontend delivery contract', () => {
  it('contains the user-facing workflow sections and server feedback hooks', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('发现项目');
    expect(source).toContain('我的申请');
    expect(source).toContain('申请审核');
    expect(source).toContain('暂停招募');
    expect(source).toContain('onFeedback');
  });

  it('mounts the real workspace app from the browser entry point', () => {
    const entry = readFileSync(new URL('../frontend/src/main.tsx', import.meta.url), 'utf8');
    expect(entry).toContain("import { App } from './App';");
    expect(entry).toContain('<App />');
    expect(entry).not.toContain('项目招募 Demo 正在启动');
  });
});
