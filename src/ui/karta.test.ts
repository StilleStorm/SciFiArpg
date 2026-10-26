import { describe, expect, it } from 'vitest';
import { HERO_IDS } from '../heroes/registry';
import { applyUpgrade } from '../progression';
import { createRun } from '../world/run';
import { kartaInputFromRun, kartaModel } from './karta';
import { commitLoadout, loadoutOf } from './konfLoadout';
import { konfiguracjaRows, konfiguracjaSpecs, konfiguracjaUltimate, padsWith } from './konfiguracja';

describe('kartaModel', () => {
  it('gives every hero three columns with a capstone each, nodes in unlock order', () => {
    for (const id of HERO_IDS) {
      const s = createRun(3, { heroId: id });
      const m = kartaModel(kartaInputFromRun(s));
      expect(m.columns).toHaveLength(3);
      for (const col of m.columns) {
        expect(col.nodes.length).toBeGreaterThan(3);
        expect(col.capName.length).toBeGreaterThan(0);
        const levels = col.nodes.map((n) => n.level).filter((l): l is number => l !== null);
        expect(levels).toEqual([...levels].sort((a, b) => a - b));
      }
    }
  });

  it('stamps what is held and greys what is gated', () => {
    const s = createRun(3, { heroId: 'pralka' });
    s.player.level = 7;
    const m = kartaModel(kartaInputFromRun(s));
    const nodes = m.columns.flatMap((c) => c.nodes);
    const skill = nodes.find((n) => n.id === 'skill:wirowanie');
    const p2 = nodes.find((n) => n.id === 'para:wirowanie:2');
    const p3 = nodes.find((n) => n.id === 'para:wirowanie:3');
    const fourth = nodes.find((n) => n.id === 'skill:beben');
    expect(skill?.state).toBe('granted');
    expect(p2?.state).toBe('granted'); // level 1 + 6
    expect(p3?.state).toBe('gated'); // level 1 + 14
    expect(p3?.note).toContain('15');
    expect(fourth?.state).not.toBe('granted'); // not installed
    expect(m.ultimate?.state).toBe('gated');
    s.player.level = 12;
    expect(kartaModel(kartaInputFromRun(s)).ultimate?.state).toBe('granted');
  });

  it('follows an installed fourth skill and a taken passive', () => {
    const s = createRun(3, { heroId: 'nalesnik' });
    s.player.permissions.push('urzadzenia');
    s.player.level = 9;
    applyUpgrade(s, 'skill4');
    applyUpgrade(s, 'passive2');
    const m = kartaModel(kartaInputFromRun(s));
    const nodes = [...m.columns.flatMap((c) => c.nodes), ...m.band];
    expect(nodes.find((n) => n.id === 'skill:plywy')?.state).toBe('granted');
    expect(nodes.find((n) => n.id === 'passive:2')?.state).toBe('granted');
  });

  it('grants one capstone at a time: the chosen column, with two equipped skills', () => {
    const s = createRun(3, { heroId: 'pralka' }); // pads: wirowanie, pranieWstepne, odwirowanie
    const none = kartaModel(kartaInputFromRun(s));
    expect(none.columns.filter((c) => c.granted)).toHaveLength(0); // nothing chosen, nothing granted
    expect(none.columns.map((c) => c.have)).toEqual([3, 2, 1]);
    commitLoadout(s, { specialization: 'osoba' });
    expect(kartaModel(kartaInputFromRun(s)).columns.filter((c) => c.granted).map((c) => c.id)).toEqual(['osoba']);
    commitLoadout(s, { specialization: 'serwis' });
    expect(kartaModel(kartaInputFromRun(s)).columns.filter((c) => c.granted)).toHaveLength(0); // beben + osobowosc are not on the pads
  });

  it('prints every passive in the band under the columns', () => {
    const m = kartaModel(kartaInputFromRun(createRun(3, { heroId: 'konsultant' })));
    expect(m.band.length).toBeGreaterThan(0);
    expect(m.band.every((n) => n.kind === 'passive')).toBe(true);
  });
});

describe('konfiguracja data', () => {
  it('padsWith swaps like assignPad', () => {
    expect(padsWith([0, 1, 2], 0, 1)).toEqual([1, 0, 2]);
    expect(padsWith([0, 1, 2], 2, 3)).toEqual([0, 1, 3]);
    expect(padsWith([0, 1, 2], 1, 1)).toEqual([0, 1, 2]);
  });

  it('commitLoadout moves pads on the run and remembers the column', () => {
    const s = createRun(3, { heroId: 'konsultant' });
    const pads = s.hero.pads;
    expect(commitLoadout(s, { pads: [1, 0, 2] }).ok).toBe(true);
    expect(s.hero.pads).toEqual([1, 0, 2]);
    expect(s.hero.pads).toBe(pads); // written in place
    expect(commitLoadout(s, { specialization: 'windykacja' }).ok).toBe(true);
    expect(loadoutOf(s).specialization).toBe('windykacja');
    expect(s.hero.spec).toBe('windykacja');
    expect(konfiguracjaSpecs(s).specs.filter((x) => x.chosen).map((x) => x.id)).toEqual(['windykacja']);
    expect(commitLoadout(s, { specialization: null }).ok).toBe(true);
    expect(s.hero.spec).toBeUndefined();
  });

  it('commitLoadout refuses a locked skill or an unknown column and changes nothing', () => {
    const s = createRun(3, { heroId: 'konsultant' });
    expect(commitLoadout(s, { pads: [0, 1, 3] })).toEqual({ ok: false, reason: 'locked' });
    expect(commitLoadout(s, { specialization: 'nieznana' })).toEqual({ ok: false, reason: 'specialization' });
    expect(s.hero.pads).toEqual([0, 1, 2]);
    expect(s.hero.spec).toBeUndefined();
  });

  it('rows carry category and pad; the ultimate row is locked until its level', () => {
    const s = createRun(3, { heroId: 'kartograf' });
    const rows = konfiguracjaRows(s);
    expect(rows.map((r) => r.pad)).toEqual([0, 1, 2, null, null, null, null, null, null, null]);
    expect(rows.every((r) => r.category !== null)).toBe(true);
    expect(konfiguracjaUltimate(s)?.locked).toBe(true);
    s.player.level = 12;
    expect(konfiguracjaUltimate(s)?.locked).toBe(false);
  });

  it('S21: the Nalesnik lists ten rows, each with a category and a column', () => {
    const s = createRun(3, { heroId: 'nalesnik' });
    const rows = konfiguracjaRows(s);
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.pad)).toEqual([0, 1, 2, null, null, null, null, null, null, null]);
    expect(rows.every((r) => r.category !== null)).toBe(true);
  });
});
