import { describe, expect, it } from 'vitest';
import type { HeroId } from '../heroes';
import { heroById, HERO_IDS } from '../heroes/registry';
import { FAMILY_FLAVOUR, RECIPES, SFX_NAMES, bodyLayers, recipeLength, validateRecipe, type Recipe } from './recipes';
import { TRIMS } from './levels';
import { ultimateSound } from './bindings';

const recipes = RECIPES as Record<string, Recipe>;

describe('recipes follow DESIGN 14', () => {
  it('every recipe validates', () => {
    for (const name of SFX_NAMES) expect(validateRecipe(name, recipes[name] as Recipe), name).toEqual([]);
  });

  it('every combat recipe has a body layer: a 60-140 Hz thump or low pluck of 80-200 ms', () => {
    const combat = SFX_NAMES.filter((n) => recipes[n]?.combat);
    expect(combat.length).toBeGreaterThanOrEqual(29);
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

  it('every hero has distinct skill sounds (five, ten once filled), all combat recipes, none shared between heroes', () => {
    const all = new Set<string>();
    let count = 0;
    for (const h of HERO_IDS) {
      const names = heroById(h).sounds.skills;
      expect(names.length).toBeGreaterThanOrEqual(5);
      expect(new Set(names).size, h).toBe(names.length);
      for (const n of names) {
        expect(recipes[n]?.combat, n).toBe(true);
        expect(validateRecipe(n, recipes[n] as Recipe), n).toEqual([]);
        all.add(n);
        count++;
      }
    }
    expect(all.size).toBe(count);
    expect(count).toBeGreaterThanOrEqual(5 * HERO_IDS.length);
  });

  it('the fourth and fifth skills each have their own recipe, with a body and no raw tone', () => {
    const own = [
      'pralkaDrum', 'pralkaPersona', 'konsCase', 'konsHangup', 'petlDejaVu', 'petlLaunch', 'kartoScale', 'kartoLegend', 'nalesTide', 'nalesMoon',
    ];
    const heroes: HeroId[] = ['pralka', 'konsultant', 'petlowiec', 'kartograf', 'nalesnik'];
    heroes.forEach((h, i) => {
      expect(heroById(h).sounds.skills[3]).toBe(own[i * 2]);
      expect(heroById(h).sounds.skills[4]).toBe(own[i * 2 + 1]);
    });
    for (const n of own) {
      const r = recipes[n] as Recipe;
      expect(bodyLayers(r).length, n).toBeGreaterThan(0);
      expect(r.layers.some((l) => l.kind === 'sine'), n).toBe(false);
      expect(recipeLength(r), n).toBeLessThan(1);
    }
  });

  it('every hero has its own ultimate recipe: a combat sound with a body, a sub, a tail and a late stamp thud, no raw tone', () => {
    const own = [
      ...['pralkaUlt', 'konsUlt', 'petlUlt', 'kartoUlt', 'nalesUlt'],
      ...['pralkaPersonUlt', 'pralkaClaimUlt', 'konsUltQueue', 'konsUltSurvey'],
      ...['kartoStrike', 'kartoSurvey'],
      ...['petlUltRewind', 'petlUltArrival'],
    ];
    const first = (h: (typeof HERO_IDS)[number]): string => heroById(h).ultimates?.[0]?.id ?? '';
    expect(new Set(HERO_IDS.map((h) => ultimateSound(h, first(h)))).size).toBe(HERO_IDS.length);
    // every ultimate of every hero has a recipe of its own hero; a hero with a name per id (S19) gives each ultimate its own
    for (const h of HERO_IDS) {
      const ids = (heroById(h).ultimates ?? []).map((u) => u.id);
      const names = ids.map((u) => ultimateSound(h, u) ?? '');
      for (const n of names) expect(own, `${h}`).toContain(n);
      if (typeof heroById(h).sounds.ultimate === 'object') expect(new Set(names).size, h).toBe(ids.length);
    }
    expect(ultimateSound('pralka', 'uznanieOsobowosci')).toBe('pralkaPersonUlt');
    expect(ultimateSound('konsultant', 'ankieta')).toBe('konsUltSurvey');
    expect(ultimateSound('konsultant', 'nieznany')).toBe('konsUlt');
    for (const n of own) {
      const r = recipes[n] as Recipe;
      expect(r.combat, n).toBe(true);
      expect(bodyLayers(r).length, n).toBeGreaterThan(0);
      expect(r.layers.some((l) => l.role === 'sub'), n).toBe(true);
      expect(r.layers.some((l) => l.role === 'tail'), n).toBe(true);
      expect(r.layers.some((l) => l.kind === 'sine'), n).toBe(false);
      // the closing stamp: a thump at least half a second in
      expect(r.layers.some((l) => l.kind === 'thump' && (l.delay ?? 0) >= 0.5), n).toBe(true);
      expect(recipeLength(r), n).toBeGreaterThan(0.8);
      expect(recipeLength(r), n).toBeLessThan(1.4);
    }
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
