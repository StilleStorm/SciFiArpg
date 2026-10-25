/** Sets (S17, ITEMS 4.1): data, the pieces, the bonuses of two and three worn pieces, the three-piece effects that live in stats. */
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createBus } from '../core/events';
import { createEnemy } from '../entities/factory';
import { createRun, nextId } from '../world/run';
import { AFFIXES_BY_ID, canCombine, rollsOnSlot } from './affixes';
import { BASES_BY_ID } from './bases';
import { conflictTag } from './compat';
import { equipItem, unequipSlot } from './inventory';
import { bindSetEffects, onSetHurt, rerollAwaria } from './setFx';
import { makeSetPiece } from './setPieces';
import { SETS, SET_IDS, hasEffect, piecesOf, setBonusStats, setLevel, setSpeedBonus, wornSetCounts } from './sets';
import { effectiveStats } from './stats';
import { addStats, emptyStats, type Item, type SetId } from './types';

const piece = (set: SetId, i: 0 | 1 | 2, seed = 3, level = 5): Item => {
  const item = makeSetPiece(createRng(seed), set, level, i);
  if (!item) throw new Error(`piece ${set} ${i}`);
  return item;
};

function wear(set: SetId, n: number, seed = 5) {
  const s = createRun(seed);
  let number = 1;
  for (let i = 0; i < n; i++) {
    const item = piece(set, i as 0 | 1 | 2, seed + i);
    item.number = number++;
    s.player.inventory.push(item);
    equipItem(s.player, item);
  }
  return s;
}

describe('set data', () => {
  it('six sets, one per tag, three pieces on three different slots', () => {
    expect(SET_IDS).toHaveLength(6);
    expect(new Set(SETS.map((d) => d.tag)).size).toBe(6);
    for (const def of SETS) {
      const slots = def.pieces.map((p) => BASES_BY_ID.get(p.baseId)?.slot);
      expect(slots.every((x) => x !== undefined), def.id).toBe(true);
      expect(new Set(slots).size, def.id).toBe(3);
    }
  });

  it('the fixed affixes exist, fit their slot, combine and are not excluded by their base; no piece dislikes its own tag', () => {
    for (const def of SETS) {
      for (const p of def.pieces) {
        const base = BASES_BY_ID.get(p.baseId);
        expect(base, p.baseId).toBeDefined();
        const affixes = p.affixes.map((id) => AFFIXES_BY_ID.get(id));
        for (const a of affixes) {
          expect(a, `${def.id}/${p.baseId}`).toBeDefined();
          if (!a || !base) continue;
          expect(rollsOnSlot(a, base.slot), `${p.baseId} ${a.id}`).toBe(true);
          expect(base.excludeAffixes ?? [], `${p.baseId} ${a.id}`).not.toContain(a.id);
          expect(a.absurd, `${p.baseId} ${a.id}`).toBeUndefined();
        }
        const [a, b] = affixes;
        if (a && b) expect(canCombine([a], b), `${def.id}/${p.baseId}`).toBe(true);
        expect(p.dislikes).not.toBe(def.tag);
      }
    }
  });

  it('the pieces of one set never clash with each other', () => {
    for (const def of SETS) {
      const items = [0, 1, 2].map((i) => piece(def.id, i as 0 | 1 | 2));
      for (const a of items) for (const b of items) if (a !== b) expect(conflictTag(a, b), def.id).toBeNull();
    }
  });
});

describe('set pieces', () => {
  it('are rzadki with the set tag, two fixed affixes and one rolled that is never a trial, a withdrawal or the free version', () => {
    for (const def of SETS) {
      for (let i = 0; i < 3; i++) {
        for (let seed = 1; seed <= 25; seed++) {
          const item = piece(def.id, i as 0 | 1 | 2, seed, 1 + seed);
          expect(item.tier).toBe('rzadki');
          expect(item.setId).toBe(def.id);
          expect(item.likes).toBe(def.tag);
          expect(item.baseId).toBe(def.pieces[i]?.baseId);
          expect(item.affixes.slice(0, 2)).toEqual([...(def.pieces[i]?.affixes ?? [])]);
          expect(item.affixes).toHaveLength(3);
          expect(item.affixes[2]).not.toMatch(/^(probny|wycofany|darmowy)$/);
          expect(item.freeVersion).toBeUndefined();
          expect(item.review).toBeDefined(); // reviews as any item
        }
      }
    }
  });

  it('the same seed builds the same piece; a set piece with no index picks one of the three', () => {
    expect(piece('serwis', 1, 9)).toEqual(piece('serwis', 1, 9));
    const bases = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) bases.add(makeSetPiece(createRng(seed), 'awaria', 4)?.baseId ?? '');
    expect(bases.size).toBe(3);
  });
});

describe('two and three worn pieces', () => {
  it('count only the pieces that do something', () => {
    const s = wear('obieg', 2);
    expect(wornSetCounts(s.player.equipment)).toEqual({ obieg: 2 });
    const blocked = piece('obieg', 2);
    blocked.blockedBy = { uid: 1, number: 1, tag: 'papier' };
    expect(wornSetCounts({ ...s.player.equipment, dokument: blocked })).toEqual({ obieg: 2 });
  });

  it('a lone piece gives no bonus; two give the stat bonus; three keep it', () => {
    for (const def of SETS) {
      const bonus = setBonusStats({ [def.id]: 1 });
      expect(bonus, def.id).toEqual(emptyStats());
      const two = setBonusStats({ [def.id]: 2 });
      expect(two, def.id).toEqual(addStats(emptyStats(), def.bonus2));
      expect(setBonusStats({ [def.id]: 3 }), def.id).toEqual(two);
      expect(setLevel(1)).toBe(0);
      expect(setLevel(2)).toBe(2);
      expect(setLevel(3)).toBe(3);
    }
  });

  it('«Obieg» with two pieces adds resistance and pewność on top of the pieces and the small like-pair bonus', () => {
    const s = wear('obieg', 2);
    const withSet = s.player.stats;
    let sum = emptyStats();
    for (const item of Object.values(s.player.equipment)) if (item) sum = addStats(sum, effectiveStats(item));
    const base = s.player.baseStats.stats;
    expect(withSet.resist['regulaminowy'] ?? 0).toBe((base.resist['regulaminowy'] ?? 0) + sum.resRegulaminowy + 12);
    expect(withSet.pewnoscSiebie).toBe(base.pewnoscSiebie + sum.pewnosc + 6 + 8); // 6: the pair of equal likes (items/compat.ts)
    expect(piecesOf(s.player, 'obieg')).toBe(2);
    expect(hasEffect(s.player, 'zgloszony-na-odparcie')).toBe(false);
  });

  it('«Ostatnia mila» adds upór and walking speed with two pieces; the speed leaves with a piece', () => {
    const s = wear('ostatnia-mila', 2);
    expect(s.player.gearSpeed).toBeCloseTo(1.08);
    expect(setSpeedBonus({ 'ostatnia-mila': 2 })).toBeCloseTo(0.08);
    unequipSlot(s.player, 'nakrycie');
    unequipSlot(s.player, 'odziez');
    expect(s.player.gearSpeed).toBeUndefined();
  });

  it('«Serwis» shortens the attack cooldown with two pieces', () => {
    const lone = wear('serwis', 1);
    const two = wear('serwis', 2);
    expect(two.player.attackCooldown).toBeLessThan(lone.player.attackCooldown);
  });

  it('three pieces switch the effect on and taking one off switches it off again', () => {
    const s = wear('domniemanie', 3);
    expect(hasEffect(s.player, 'do-weryfikacji-pierwsze')).toBe(true);
    expect(piecesOf(s.player, 'domniemanie')).toBe(3);
    unequipSlot(s.player, 'dokument');
    expect(hasEffect(s.player, 'do-weryfikacji-pierwsze')).toBe(false);
    expect(s.player.sets).toEqual({ domniemanie: 2 });
  });
});

describe('the effects of three pieces', () => {
  it('«Obieg»: the rebuttal of a regulaminowy claim also stamps the enemy zgłoszony for 2 s', () => {
    const s = wear('obieg', 3);
    const bus = createBus();
    bindSetEffects(bus, () => s);
    const e = createEnemy(nextId(s), 100, 100, 1);
    e.claim = { textKey: 'x', type: 'regulaminowy', struck: true };
    const other = createEnemy(nextId(s), 140, 100, 1);
    other.claim = { textKey: 'x', type: 'mechaniczny', struck: true };
    s.enemies.push(e, other);
    bus.emit('enemy:rebutted', { id: e.id });
    bus.emit('enemy:rebutted', { id: other.id });
    expect(e.statuses.find((x) => x.kind === 'zgloszony')?.remaining).toBe(2);
    expect(other.statuses.find((x) => x.kind === 'zgloszony')).toBeUndefined();
  });

  it('«Domniemanie»: the first egzystencjalny hit on an enemy needs verification for 1 s, once', () => {
    const s = wear('domniemanie', 3);
    const e = createEnemy(nextId(s), 100, 100, 1);
    onSetHurt(s, e, 'mechaniczny');
    expect(e.statuses).toHaveLength(0);
    onSetHurt(s, e, 'egzystencjalny');
    expect(e.statuses.find((x) => x.kind === 'do_weryfikacji')?.remaining).toBe(1);
    e.statuses.length = 0;
    onSetHurt(s, e, 'egzystencjalny');
    expect(e.statuses).toHaveLength(0);
  });

  it('«Domniemanie» with two pieces lowers the existence of a Wygenerowane by 0.1 on its first hit, to 0.3 at most', () => {
    const s = wear('domniemanie', 2);
    const e = createEnemy(nextId(s), 100, 100, 1);
    e.existence = 0.35;
    onSetHurt(s, e, 'mechaniczny');
    expect(e.existence).toBeCloseTo(0.3);
    onSetHurt(s, e, 'mechaniczny');
    expect(e.existence).toBeCloseTo(0.3);
    const f = createEnemy(nextId(s), 100, 100, 1);
    f.existence = 0.9;
    onSetHurt(s, f, 'mechaniczny');
    expect(f.existence).toBeCloseTo(0.8);
  });

  it('«Serwis»: a crit inside the cast of the first skill resets its cooldown, at most once per two seconds', () => {
    const s = wear('serwis', 3);
    const bus = createBus();
    bindSetEffects(bus, () => s);
    const cast = (): void => bus.emit('skill:cast', { slot: 0, skill: 0, free: false });
    s.time = 10;
    s.hero.cd[0] = 5;
    bus.emit('enemy:hit', { id: 1, x: 0, y: 0, amount: 5, crit: false });
    cast();
    expect(s.hero.cd[0]).toBe(5);
    bus.emit('enemy:hit', { id: 1, x: 0, y: 0, amount: 5, crit: true });
    cast();
    expect(s.hero.cd[0]).toBe(0);
    s.hero.cd[0] = 5;
    s.time = 11;
    bus.emit('enemy:hit', { id: 1, x: 0, y: 0, amount: 5, crit: true });
    cast();
    expect(s.hero.cd[0]).toBe(5); // inside the two seconds
    s.time = 12.5;
    bus.emit('enemy:hit', { id: 1, x: 0, y: 0, amount: 5, crit: true });
    cast();
    expect(s.hero.cd[0]).toBe(0);
  });

  it('«Awaria»: every worn piece is scaled by up to 15% on a page entry, the same for the same ticket and page, and not with two pieces', () => {
    const two = wear('awaria', 2);
    expect(rerollAwaria(two)).toBe(false);
    const s = wear('awaria', 3);
    const before = Object.values(s.player.equipment).map((i) => (i ? effectiveStats(i).racja + effectiveStats(i).pewnosc + effectiveStats(i).resMechaniczny : 0));
    expect(rerollAwaria(s)).toBe(true);
    for (const item of Object.values(s.player.equipment)) {
      expect(item?.rollMul).toBeGreaterThanOrEqual(0.85);
      expect(item?.rollMul).toBeLessThanOrEqual(1.15);
    }
    const first = Object.values(s.player.equipment).map((i) => i?.rollMul);
    s.pageIndex = 1;
    rerollAwaria(s);
    expect(Object.values(s.player.equipment).map((i) => i?.rollMul)).not.toEqual(first);
    s.pageIndex = 0;
    rerollAwaria(s);
    expect(Object.values(s.player.equipment).map((i) => i?.rollMul)).toEqual(first);
    expect(before.length).toBe(3);
    unequipSlot(s.player, 'bron');
    expect(Object.values(s.player.equipment).every((i) => i?.rollMul === undefined)).toBe(true);
    expect(s.player.inventory.every((i) => i.rollMul === undefined)).toBe(true); // the piece taken off reads its own numbers again
  });
});
