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

  it('keeps the discovery summary readable and free of campaign copy', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../frontend/src/styles.css', import.meta.url), 'utf8');
    expect(source).not.toContain('/ 07');
    expect(source).not.toContain('真实项目');
    expect(styles).toContain('flex: 0 0 240px');
    expect(styles).toContain('grid-template-columns: 28px 72px 1fr');
  });

  it('reserves a safe area between the login headline and decorative sticker', () => {
    const styles = readFileSync(new URL('../frontend/src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('max-width: min(650px, calc(100% - 150px))');
    expect(styles).toContain('.login-visual .sticker');
    expect(styles).toContain('pointer-events: none');
  });

  it('uses grouped markup for the login and discovery summary typography', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('className="login-title"');
    expect(source).not.toContain('找到适合你的<br />');
    expect(source).toContain('className="hero-note-arrow"');
    expect(source).toContain('className="hero-note-count"');
    expect(source).toContain('className="hero-note-label"');
  });

  it('keeps the primary login headline from breaking into single-character lines', () => {
    const styles = readFileSync(new URL('../frontend/src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('.login-title span, .login-title em');
    expect(styles).toContain('white-space: nowrap');
    expect(styles).toContain('font-size: clamp(42px, 5vw, 76px)');
    expect(styles).toContain('font-size: clamp(38px, 4.6vw, 68px)');
  });

  it('keeps dark application fields readable while typing', () => {
    const styles = readFileSync(new URL('../frontend/src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('.apply-card input::placeholder');
    expect(styles).toContain('.apply-card textarea::placeholder');
    expect(styles).toContain('caret-color: var(--sun)');
  });

  it('supports adding and removing multiple recruitment roles in the publish form', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('roles.map');
    expect(source).toContain('添加招募角色');
    expect(source).toContain('删除角色');
  });

  it('renders explicit project load failures and existing application states', () => {
    const source = readFileSync(new URL('../frontend/src/App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('projectError');
    expect(source).toContain('你已提交待审核申请');
    expect(source).toContain('你已经是本项目成员');
  });
});
