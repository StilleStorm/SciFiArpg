import { describe, expect, it } from 'vitest';
import type { HeroId } from '../heroes';
import { FAMILY_FLAVOUR, HERO_SKILL_SOUNDS, RECIPES, SFX_NAMES, bodyLayers, recipeLength, validateRecipe, type Recipe } from './recipes';
import { TRIMS } from './levels';

const recipes = RECIPES as Record<string, Recipe>;

describe('recipes follow DESIGN 14', () => {
  it('every recipe validates', () => {
    for (const name of SFX_NAMES) expect(validateRecipe(name, recipes[name] as Recipe), name).toEqual([]);
  });

  it('every combat recipe has a body layer: a 60-140 Hz thump or low pluck of 80-200 ms', () => {
    const combat = SFX_NAMES.filter((n) => recipes[n]?.combat);
    expect(combat.length).toBeGreaterThanOrEqual(19);
    for (const name of combat) {
      const bodies = bodyLayers(recipes[name] as Recipe);
      expect(bodies.length, name).toBeGreaterThan(0);
      for (const b of bodies) {
        expect(b.freq).toBeGreaterThanOrEqual(60);
        expect(b.freq).toBeLessThanOrEqual(140);
      }
    }
  });

  it('a combat sound without a body is rejected by the validator', () => {
    const bad: Recipe = { combat: true, layers: [{ kind: 'click', freq: 3000, attack: 0.001, decay: 0.01, gain: 0.5, role: 'transient' }] };
    expect(validateRecipe('bad', bad).join()).toContain('without a body');
    const high: Recipe = { combat: true, layers: [{ kind: 'thump', freq: 200, attack: 0.001, decay: 0.12, gain: 0.5, role: 'body' }, { kind: 'click', freq: 3000, attack: 0.001, decay: 0.01, gain: 0.5, role: 'transient' }] };
    expect(validateRecipe('high', high).join()).toContain('without a body');
  });

  it('hit = transient + body + tail; crit adds a 50 Hz sub, a plop and splatter dots; kill = two heavy strokes + scribble', () => {
    const roles = (n: string): string[] => (recipes[n]?.layers ?? []).map((l) => l.role ?? '');
    expect(roles('hit')).toEqual(expect.arrayContaining(['transient', 'body', 'tail']));
    const crit = recipes['crit'] as Recipe;
    const sub = crit.layers.find((l) => l.role === 'sub');
    expect(sub?.freq).toBe(50);
    expect(crit.layers.some((l) => l.kind === 'thump' && l.freq > 200 && l.role === 'transient')).toBe(true); // the plop
    expect(crit.layers.some((l) => (l.repeat ?? 0) >= 6 && l.role === 'tail')).toBe(true); // splatter dots
    expect(recipeLength(crit)).toBeGreaterThan(recipeLength(recipes['hit'] as Recipe));
    const kill = recipes['kill'] as Recipe;
    const strokes = bodyLayers(kill);
    expect(strokes.length).toBe(2);
    expect(new Set(strokes.map((s) => s.delay ?? 0)).size).toBe(2);
    expect(kill.layers.some((l) => (l.repeat ?? 0) >= 10 && l.role === 'tail')).toBe(true); // pencil scribble
  });

  it('player hurt is a paper tear with a low body; low racja adds a faint hiss bed', () => {
    const hurt = recipes['playerHurt'] as Recipe;
    const low = recipes['playerHurtLow'] as Recipe;
    expect(bodyLayers(hurt).length).toBeGreaterThan(0);
    expect(low.layers.length).toBe(hurt.layers.length + 1);
    const hiss = low.layers[low.layers.length - 1];
    expect(hiss?.freq).toBeGreaterThanOrEqual(5000);
    expect(hiss?.gain).toBeLessThan(0.12);
  });

  it('every hero has three distinct skill sounds, all combat recipes, twelve in all', () => {
    const heroes: HeroId[] = ['pralka', 'konsultant', 'petlowiec', 'kartograf'];
    const all = new Set<string>();
    for (const h of heroes) {
      const trio = HERO_SKILL_SOUNDS[h];
      expect(new Set(trio).size).toBe(3);
      for (const n of trio) {
        expect(recipes[n]?.combat, n).toBe(true);
        all.add(n);
      }
    }
    expect(all.size).toBe(12);
  });

  it('every family has its own flavour; the three differ', () => {
    expect(new Set(Object.values(FAMILY_FLAVOUR)).size).toBe(3);
    for (const n of Object.values(FAMILY_FLAVOUR)) expect(recipes[n]).toBeDefined();
    // a notification pings dry and damped: a short pluck, no long tail, no bell ring
    const notice = recipes['flavNotice'] as Recipe;
    expect(notice.layers.every((l) => l.kind === 'pluck' && l.decay <= 0.1)).toBe(true);
    // devices clank on metal: narrow, high-Q inharmonic bands
    expect((recipes['flavDevice'] as Recipe).layers.filter((l) => (l.q ?? 0) >= 12).length).toBeGreaterThanOrEqual(3);
    // beasts are granular ticks
    expect((recipes['flavBeast'] as Recipe).layers.some((l) => (l.repeat ?? 0) >= 8)).toBe(true);
  });

  it('the menu and page sounds of DESIGN 14.3 all exist', () => {
    for (const n of ['footnote', 'correction', 'stamp', 'paperSlide', 'scratches3', 'cardDrawn', 'pageTurn', 'pageEdge', 'holdBeep']) {
      expect(recipes[n], n).toBeDefined();
    }
    // the page turn is two noise sweeps in about 400 ms
    const turn = recipes['pageTurn'] as Recipe;
    expect(turn.layers.filter((l) => l.kind === 'noise' && l.pitchDrop !== undefined).length).toBe(2);
    expect(recipeLength(turn)).toBeGreaterThan(0.35);
    expect(recipeLength(turn)).toBeLessThan(0.5);
    // three quick scratches
    expect((recipes['scratches3'] as Recipe).layers).toHaveLength(3);
    // the stamp is a thud and a paper slap
    expect(bodyLayers(recipes['stamp'] as Recipe).length).toBe(1);
  });

  it('the only raw oscillator tones are telephone-band sines (the hold beep and its relatives)', () => {
    for (const name of SFX_NAMES) {
      for (const l of (recipes[name] as Recipe).layers) {
        if (l.kind === 'sine') {
          expect(['holdBeep', 'konsBeep', 'botOn']).toContain(name);
          expect(l.freq).toBeGreaterThanOrEqual(300);
          expect(l.freq).toBeLessThanOrEqual(3400);
        }
      }
    }
  });

  it('is calibrated: every recipe has a level trim, and none is wild', () => {
    for (const name of SFX_NAMES) {
      const trim = recipes[name]?.trim;
      expect(trim, name).toBeDefined();
      expect(trim ?? 0).toBeGreaterThan(0.1);
      expect(trim ?? 0).toBeLessThan(5);
    }
    expect(Object.keys(TRIMS).every((n) => recipes[n])).toBe(true);
  });

  it('stays light in the menus: nothing there is a combat sound', () => {
    for (const n of ['footnote', 'correction', 'paperSlide', 'scratches3', 'cardDrawn', 'inventoryOpen', 'inventoryClose', 'pageTurn', 'pageEdge', 'holdBeep']) {
      expect(recipes[n]?.combat, n).toBeFalsy();
    }
  });
});
