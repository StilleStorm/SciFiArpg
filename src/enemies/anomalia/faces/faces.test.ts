import { describe, expect, it } from 'vitest';
import { hasStatus } from '../../../combat/status';
import { createBus, type Bus } from '../../../core/events';
import { createEnemy } from '../../../entities/factory';
import type { Enemy } from '../../../entities/types';
import { HERO_IDS, type HeroId } from '../../../heroes';
import { t } from '../../../i18n';
import { createRun, type RunState } from '../../../world/run';
import { layoutAssembly } from '../../assemble';
import { bodiesOf, bodyById } from '../../parts';
import { rtOf } from '../../runtime';
import { faceFor, faceKeys } from '../index';
import { faceAssembly } from './assembly';
import { FACE_END_FRACTION } from './common';
import { FACE_FIGURES, FIGURE_IDS } from './figures';
import { HOLD_S, HOLD_WAIT_S, TRANSFER_MIN_DIST, transfersOf } from './kierownik';
import { edgeOnOf, EDGE_EXISTENCE, EDGE_DAMAGE_MUL } from './obserwatorium';
import { isReal, MEASURED_S, partAt } from './planeta';
import { RING_N, REWIND_BELOW, ringSizeOf, rewindsOf } from './wezel';
import { STRIP_S, STRIP_WAIT_S, strippedOf, stripsOf } from './serwisant';

function setup(heroId: HeroId): { s: RunState; e: Enemy; bus: Bus } {
  const s = createRun(7, { heroId });
  s.enemies.length = 0;
  const e = createEnemy(900, 600, 500, 5);
  e.hp = e.hpMax = 1000;
  e.family = 'wygenerowane';
  e.existence = 1;
  s.enemies.push(e);
  s.player.x = 300;
  s.player.y = 1200;
  return { s, e, bus: createBus() };
}
/** Run the face for `seconds` in 1/60 s steps. */
function run(s: RunState, e: Enemy, bus: Bus, seconds: number): void {
  const face = faceFor(s.player.heroId);
  if (!face) throw new Error('no face');
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    face.tick(s, e, bus, 1 / 60);
  }
}

describe('registry and figures', () => {
  it('pins every hero to its own face', () => {
    expect(faceFor('konsultant')?.figure).toBe(FIGURE_IDS.kierownik);
    expect(faceFor('pralka')?.figure).toBe(FIGURE_IDS.serwisant);
    expect(faceFor('petlowiec')?.figure).toBe(FIGURE_IDS.wezel);
    expect(faceFor('kartograf')?.figure).toBe(FIGURE_IDS.planeta);
    expect(faceFor('nalesnik')?.figure).toBe(FIGURE_IDS.obserwatorium);
    expect(t(faceKeys('pralka').name)).toBe('Serwisant Autoryzowany');
  });
  it('has a face for every hero, with text for every key', () => {
    for (const id of HERO_IDS) {
      const f = faceFor(id);
      expect(f?.heroId).toBe(id);
      const k = faceKeys(id);
      for (const key of [k.name, k.meet, k.line, k.comment, k.end, k.reply('mechaniczny'), k.reply('regulaminowy'), k.reply('egzystencjalny')]) {
        expect(t(key)).not.toBe(key);
      }
    }
  });
  it('draws five distinct figures that stay out of the random assembly', () => {
    expect(FACE_FIGURES).toHaveLength(5);
    for (const id of HERO_IDS) {
      const f = faceFor(id);
      expect(f && bodyById(f.figure)).toBeDefined();
      const asm = faceAssembly(id);
      expect(asm).not.toBeNull();
      if (asm) expect(layoutAssembly(asm).layers[0]?.art.line?.length).toBeGreaterThan(150);
    }
    for (const fam of ['urzadzenia', 'powiadomienia', 'wygenerowane'] as const) {
      expect(bodiesOf(fam).some((b) => b.figure)).toBe(false);
    }
  });
});

describe('Kierownik Kolejki', () => {
  it('puts the hero on hold and transfers them across the page, then lets go', () => {
    const { s, e, bus } = setup('konsultant');
    const face = faceFor('konsultant');
    face?.start(s, e, bus);
    run(s, e, bus, HOLD_WAIT_S + 0.2);
    expect(hasStatus(s.player, 'wyciszony')).toBe(true);
    const from = { x: s.player.x, y: s.player.y };
    run(s, e, bus, HOLD_S + 0.2);
    expect(transfersOf(e)).toBe(1);
    expect(Math.hypot(s.player.x - from.x, s.player.y - from.y)).toBeGreaterThan(150);
    expect(Math.hypot(s.player.x - e.x, s.player.y - e.y)).toBeGreaterThanOrEqual(TRANSFER_MIN_DIST - 1);
    expect(hasStatus(s.player, 'wyciszony')).toBe(false);
  });
  it('stop takes the hold off', () => {
    const { s, e, bus } = setup('konsultant');
    const face = faceFor('konsultant');
    face?.start(s, e, bus);
    run(s, e, bus, HOLD_WAIT_S + 0.2);
    expect(hasStatus(s.player, 'wyciszony')).toBe(true);
    face?.stop(s, e, bus);
    expect(hasStatus(s.player, 'wyciszony')).toBe(false);
  });
});

describe('Serwisant Autoryzowany', () => {
  function stripped() {
    const r = setup('pralka');
    r.s.hero.para = [1, 2, 1, 3, 1];
    r.s.hero.patch = [undefined, { dmg: 1.2 }, undefined, { dur: 2 }, undefined];
    const face = faceFor('pralka');
    face?.start(r.s, r.e, r.bus);
    run(r.s, r.e, r.bus, STRIP_WAIT_S + 0.2);
    return { ...r, face };
  }
  it('strips one installed paragraph and gives it back after ten seconds', () => {
    const { s, e, bus } = stripped();
    const sp = strippedOf(e);
    expect(sp).not.toBeNull();
    const i = sp?.skill ?? -1;
    expect(s.hero.para?.[i]).toBe(1);
    expect(s.hero.patch?.[i]).toBeUndefined();
    expect(s.hero.para?.filter((n) => n > 1)).toHaveLength(1);
    run(s, e, bus, STRIP_S + 0.2);
    expect(strippedOf(e)).toBeNull();
    expect([s.hero.para?.[1], s.hero.para?.[3]]).toEqual([2, 3]);
    expect(s.hero.patch?.[1]).toEqual({ dmg: 1.2 });
  });
  it('is won back at once by rebutting the Serwisant', () => {
    const { s, e, bus } = stripped();
    expect(strippedOf(e)).not.toBeNull();
    bus.emit('enemy:rebutted', { id: e.id });
    expect(strippedOf(e)).toBeNull();
    expect([s.hero.para?.[1], s.hero.para?.[3]]).toEqual([2, 3]);
    // his bubble stands again a little later, and he strips again after the wait
    e.claim && (e.claim.struck = true);
    run(s, e, bus, STRIP_WAIT_S + 3);
    expect(e.claim?.struck).toBe(false);
    expect(stripsOf(e)).toBe(2);
  });
  it('stop gives everything back', () => {
    const { s, e, bus, face } = stripped();
    face?.stop(s, e, bus);
    expect([s.hero.para?.[1], s.hero.para?.[3]]).toEqual([2, 3]);
    expect(s.hero.patch?.[3]).toEqual({ dur: 2 });
    // and nothing is left listening
    bus.emit('enemy:rebutted', { id: e.id });
  });
  it('strips nothing from a hero with every skill on paragraph 1', () => {
    const { s, e, bus } = setup('pralka');
    const face = faceFor('pralka');
    face?.start(s, e, bus);
    run(s, e, bus, STRIP_WAIT_S * 2);
    expect(stripsOf(e)).toBe(0);
  });
});

describe('Wezel', () => {
  it('rewinds the page three seconds the first time it is hurt below a threshold, and only once per threshold', () => {
    const { s, e, bus } = setup('petlowiec');
    const face = faceFor('petlowiec');
    face?.start(s, e, bus);
    const start = { x: s.player.x, y: s.player.y };
    s.player.hp = s.player.hpMax;
    // 4 seconds of walking and a fight
    for (let i = 0; i < 240; i++) {
      s.player.x += 1;
      s.player.hp = Math.max(1, s.player.hp - 0.05);
      run(s, e, bus, 1 / 60);
    }
    const hpNow = s.player.hp;
    e.hp = e.hpMax * (REWIND_BELOW[0] ?? 0.85) - 5;
    run(s, e, bus, 1 / 60);
    expect(rewindsOf(e)).toBe(1);
    expect(e.hp).toBe(e.hpMax); // the Wezel is back as it was
    expect(s.player.x).toBeLessThan(start.x + 240 - 150); // the hero too, about three seconds back
    expect(s.player.x).toBeGreaterThan(start.x + 40);
    expect(s.player.hp).toBeGreaterThanOrEqual(hpNow);
    run(s, e, bus, 1);
    e.hp = e.hpMax * 0.8;
    run(s, e, bus, 1 / 60);
    expect(rewindsOf(e)).toBe(1);
  });
  it('keeps a bounded ring without growing', () => {
    const { s, e, bus } = setup('petlowiec');
    faceFor('petlowiec')?.start(s, e, bus);
    run(s, e, bus, 30);
    expect(ringSizeOf(e)).toBe(RING_N);
    expect(RING_N).toBeLessThan(40);
  });
  it('a right Spor reply spends the rewinds', () => {
    const { s, e, bus } = setup('petlowiec');
    faceFor('petlowiec')?.start(s, e, bus);
    bus.emit('spor:answered', { id: 1, index: 0, right: true });
    run(s, e, bus, 1);
    e.hp = e.hpMax * 0.5;
    run(s, e, bus, 0.1);
    expect(rewindsOf(e)).toBe(0);
    expect(e.hp).toBe(e.hpMax * 0.5);
  });
});

describe('Planeta Niestniejaca', () => {
  const laser = (bus: Bus, sx: number, sy: number, ex: number, ey: number) =>
    bus.emit('attack:started', { attackerId: 1, attacker: 'player', x: sx, y: sy, tx: ex, ty: ey, ranged: true, laser: { sx, sy, ex, ey, crit: false, metres: 1 } });
  it('cannot be hurt anywhere until a laser measures it, then only on the measured part', () => {
    const { s, e, bus } = setup('kartograf');
    const face = faceFor('kartograf');
    face?.start(s, e, bus);
    const left = { x: e.x - e.r * 0.8, y: e.y };
    const right = { x: e.x + e.r * 0.8, y: e.y };
    expect(face?.damageMul(s, e, left.x, left.y)).toBe(0);
    expect(face?.damageMul(s, e, right.x, right.y)).toBe(0);
    laser(bus, e.x - e.r * 3, e.y, left.x, left.y);
    expect(face?.damageMul(s, e, left.x, left.y)).toBe(1);
    expect(face?.damageMul(s, e, right.x, right.y)).toBe(0);
    expect(isReal(e, partAt(e, right.x, right.y))).toBe(false);
  });
  it('forgets a measurement after its time, and ignores other attackers', () => {
    const { s, e, bus } = setup('kartograf');
    const face = faceFor('kartograf');
    face?.start(s, e, bus);
    bus.emit('attack:started', { attackerId: 2, attacker: 'enemy', x: 0, y: 0, tx: 0, ty: 0, ranged: true, laser: { sx: e.x - 80, sy: e.y, ex: e.x, ey: e.y, crit: false, metres: 1 } });
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(0);
    laser(bus, e.x - 80, e.y, e.x, e.y);
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(1);
    run(s, e, bus, MEASURED_S + 0.5);
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(0);
  });
  it('stop forgets everything and stops listening', () => {
    const { s, e, bus } = setup('kartograf');
    const face = faceFor('kartograf');
    face?.start(s, e, bus);
    face?.stop(s, e, bus);
    laser(bus, e.x - 80, e.y, e.x, e.y);
    face?.start(s, e, bus);
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(0);
  });
});

describe('Obserwatorium', () => {
  const roll = (s: RunState) => {
    s.hero.roll = { dx: 1, dy: 0, left: 1, speed: 300, hit: [], rank: 1 };
  };
  it('is fully there for a flat hero', () => {
    const { s, e, bus } = setup('nalesnik');
    const face = faceFor('nalesnik');
    face?.start(s, e, bus);
    s.player.x = e.x - 100;
    s.player.y = e.y;
    run(s, e, bus, 1);
    expect(edgeOnOf(e)).toBe(false);
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(1);
    expect(e.existence).toBe(1);
    expect(rtOf(e).dmgMult).toBe(1);
  });
  it('does not see a rolling hero: existence drops, it cannot hurt, hits count little', () => {
    const { s, e, bus } = setup('nalesnik');
    const face = faceFor('nalesnik');
    face?.start(s, e, bus);
    s.player.x = e.x - 100;
    s.player.y = e.y;
    roll(s);
    e.attackTimer = 0;
    run(s, e, bus, 0.2);
    expect(edgeOnOf(e)).toBe(true);
    expect(e.existence).toBe(EDGE_EXISTENCE);
    expect(rtOf(e).dmgMult).toBe(0);
    expect(e.attackTimer).toBeGreaterThan(0);
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(EDGE_DAMAGE_MUL);
    // flat again
    s.hero.roll = null;
    run(s, e, bus, 0.2);
    expect(e.existence).toBe(1);
    expect(rtOf(e).dmgMult).toBe(1);
    expect(face?.damageMul(s, e, e.x, e.y)).toBe(1);
  });
  it('a roll far away, or a rounded-up hero, is still seen', () => {
    const { s, e, bus } = setup('nalesnik');
    const face = faceFor('nalesnik');
    face?.start(s, e, bus);
    roll(s);
    run(s, e, bus, 0.1);
    expect(edgeOnOf(e)).toBe(false); // the hero stands far off
    s.player.x = e.x - 100;
    s.player.y = e.y;
    s.player.round = true;
    run(s, e, bus, 0.1);
    expect(edgeOnOf(e)).toBe(false);
  });
  it('stop undoes the hold and the existence', () => {
    const { s, e, bus } = setup('nalesnik');
    const face = faceFor('nalesnik');
    face?.start(s, e, bus);
    s.player.x = e.x - 100;
    s.player.y = e.y;
    roll(s);
    run(s, e, bus, 0.2);
    face?.stop(s, e, bus);
    expect(rtOf(e).dmgMult).toBe(1);
    expect(e.existence).toBe(1);
    expect(rtOf(e).ePin).toBeNull();
  });
});

describe('every face', () => {
  it('ends once the Anomalia is down to the face threshold', () => {
    for (const id of HERO_IDS) {
      const { s, e, bus } = setup(id);
      const face = faceFor(id);
      face?.start(s, e, bus);
      expect(face?.done(s, e)).toBe(false);
      e.hp = e.hpMax * FACE_END_FRACTION;
      expect(face?.done(s, e)).toBe(true);
      face?.stop(s, e, bus);
    }
  });
});
