import { describe, expect, it } from 'vitest';
import { assignPad } from '../heroes/loadout';
import { applyUpgrade } from '../progression';
import { createRun } from '../world/run';
import { loadoutRows } from './loadout';

describe('loadoutRows', () => {
  it('lists the hero\'s skills; the fourth and fifth are greyed with their permission until an update installs them', () => {
    const s = createRun(3, { heroId: 'pralka' });
    const rows = loadoutRows(s);
    expect(rows).toHaveLength(10); // five, and the five of S19
    expect(rows.map((r) => r.installed)).toEqual([true, true, true, false, false, false, false, false, false, false]);
    expect(rows.map((r) => r.pad)).toEqual([0, 1, 2, null, null, null, null, null, null, null]);
    expect(rows.slice(5).every((r) => r.requires === null)).toBe(true); // the later skills open by level, no permission
    expect(rows[0]?.rank).toBe('—');
    expect(rows[3]?.requires).toContain('urządzenia');
    expect(rows[4]?.requires).toContain('wygenerowane');
    expect(rows[2]?.requires).toBeNull();
    expect(rows.every((r) => r.name.length > 0 && r.desc.length > 0 && r.type.length > 0)).toBe(true);
  });

  it('shows ranks in roman numerals and follows an assignment', () => {
    const s = createRun(3, { heroId: 'nalesnik' });
    s.player.permissions.push('urzadzenia');
    applyUpgrade(s, 'skill4');
    applyUpgrade(s, 'skill4');
    applyUpgrade(s, 'skill1');
    expect(assignPad(s, 1, 3)).toBe(true);
    const rows = loadoutRows(s);
    expect(rows[3]).toMatchObject({ installed: true, rank: 'II', pad: 1, requires: null });
    expect(rows[1]?.pad).toBeNull(); // displaced from pad 2, off the pads
    expect(rows[0]?.rank).toBe('I');
    expect(rows.filter((r) => r.pad !== null)).toHaveLength(3);
  });
});
