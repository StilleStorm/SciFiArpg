import { describe, expect, it } from 'vitest';
import { createRun } from './run';
import { EXIT_SIGHT, exitVisible } from './pages';

describe('exit dog-ear sight', () => {
  const s = createRun(4, { pageCount: 4 });
  const exit = s.page.exit;
  it('is hidden far away, drawn within 400 units, and always visible to the Kartograf', () => {
    expect(exit).not.toBeNull();
    if (!exit) return;
    const far = { x: exit.x < 600 ? exit.x + 900 : exit.x - 900, y: exit.y < 800 ? exit.y + 1100 : exit.y - 1100 };
    expect(exitVisible(s.page, far, false)).toBe(false);
    expect(exitVisible(s.page, far, true)).toBe(true);
    const near = { x: exit.x + (exit.x < 600 ? 1 : -1) * (EXIT_SIGHT - 10), y: exit.y };
    expect(exitVisible(s.page, near, false)).toBe(true);
  });
  it('the last page has no dog-ear to show', () => {
    const last = createRun(4, { pageCount: 1 });
    expect(last.page.exit).toBeNull();
    expect(exitVisible(last.page, last.player, true)).toBe(false);
  });
});
