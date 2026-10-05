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

  it('uses a distinct collaboration-focused visual system', () => {
    const styles = readFileSync(new URL('../frontend/src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('--forest');
    expect(styles).toContain('--sun');
    expect(styles).toContain('.app-shell::before');
    expect(styles).toContain('.project-card:hover');
  });

  it('provides a visible back action for every secondary workspace view', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('function PageBack');
    expect(source.match(/<PageBack/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps page headings free of sentence-ending punctuation', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    const headings = [...source.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)]
      .map((match) => match[1].replace(/<[^>]+>/g, ''))
      .filter((heading) => !heading.includes('{'));
    expect(headings.length).toBeGreaterThan(3);
    expect(headings.every((heading) => !/[。！？.!?]/u.test(heading))).toBe(true);
  });

  it('keeps secondary navigation and interface copy consistent', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain("view === 'created' && selectedId");
    expect(source).not.toContain('JOIN THIS PROJECT');
    expect(source).not.toContain('PROJECT LEAD');
  });

  it('uses product-facing Chinese copy for the login and workspace surfaces', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('登录组队集市');
    expect(source).toContain('找到适合你的');
    expect(source).toContain('项目发起人');
    expect(source).not.toContain('PROJECT MARKET');
    expect(source).not.toContain('REAL');
    expect(source).not.toContain('TEAM MARKET');
  });
});
