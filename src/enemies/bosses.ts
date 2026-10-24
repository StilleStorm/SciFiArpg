/**
 * Bosses, one per family, with a simple phase model (DESIGN 6).
 * Prototyp: every part; at half racja it drops a leg and speeds up.
 * Weryfikacja: stands still, summons Przypomnienia every 6 s; standing on its two hydrant squares for 2 s in
 * total blocks it for 3 s. The grid is a 3x3 of hatched squares drawn around it (render/enemyFigures.ts).
 * Hipoteza: e = 0.3 until the player stands inside its outline for 3 s; then e = 1 and attacks come 1.5x faster.
 */
import { SPOR_FIRST_S, postSpor } from '../combat/spor';
import { applyStatus, isSilenced, isStunned } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { t } from '../i18n';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import { assembleBoss } from './assemble';
import { BOSS_OF, FAMILY_DEFS, FAMILY_IDS, type BossId, type FamilyId } from './families';
import { makeEnemy } from './make';
import { newRt, rtOf } from './runtime';
import { placeEnemy } from './spawn';

/** Seconds on the hydrant squares needed to block Weryfikacja, and how long the block lasts. */
export const GRID_NEED_S = 2;
export const GRID_BLOCK_S = 3;
export const GRID_CELL = 52;
/** Hipoteza: radius of the drawn outline, and seconds inside it to confirm it. */
export const CONFIRM_R = 72;
export const CONFIRM_NEED_S = 3;
export const SUMMON_EVERY_S = 6;
const SUMMON_CAP = 6;
export const BOSS_HIPOTEZA_E = 0.3;

interface BossDef {
  hp: number;
  speed: number;
  dmgMin: number;
  dmgMax: number;
  pewnoscSiebie: number;
  upor: number;
  attackRange: number;
  attackCooldown: number;
  /** The claim: its type is the family's weakness, so the clean play opens with a rebuttal. */
  claimType: 'mechaniczny' | 'regulaminowy' | 'egzystencjalny';
}

export const BOSSES: Record<BossId, BossDef> = {
  prototyp: { hp: 300, speed: 50, dmgMin: 5, dmgMax: 8, pewnoscSiebie: 80, upor: 50, attackRange: 44, attackCooldown: 1.5, claimType: 'egzystencjalny' },
  weryfikacja: { hp: 220, speed: 0, dmgMin: 3, dmgMax: 5, pewnoscSiebie: 70, upor: 40, attackRange: 40, attackCooldown: 1.4, claimType: 'regulaminowy' },
  hipoteza: { hp: 260, speed: 46, dmgMin: 6, dmgMax: 9, pewnoscSiebie: 80, upor: 40, attackRange: 42, attackCooldown: 1.3, claimType: 'mechaniczny' },
};

/**
 * A planet's variant of its family boss (STORY 4, 8.0): a line printed under the boss's name and one data change (racja here).
 * A planet module registers it (`world/planets/p1.ts`); the Spor comments of the variant are `combat/spor.ts`.
 */
export interface BossVariant {
  boss: BossId;
  /** i18n key of the line under the name. */
  lineKey: string;
  /** The racja the variant has instead of `BOSSES[boss].hp`. */
  hp: number;
}

const VARIANTS = new Map<number, BossVariant>();
const variantLines = new WeakMap<object, string>();

/** Register the boss variant of a planet (0-based index). */
export function registerBossVariant(planet: number, v: BossVariant): void {
  VARIANTS.set(planet, v);
}

/** The variant a planet gives its boss, if one is registered. */
export const bossVariantOf = (planet: number | undefined): BossVariant | undefined => (planet === undefined ? undefined : VARIANTS.get(planet));

/** The key of the variant line under this boss's name, or undefined for a plain family boss. */
export const bossVariantLine = (e: object): string | undefined => variantLines.get(e);

export const bossIdOf = (e: Enemy): BossId | null => (e.boss ? BOSS_OF[e.family] : null);

/** World position of the center of grid cell `i` (0..8, row-major) of a Weryfikacja. */
export function gridCellCenter(cx: number, cy: number, i: number): { x: number; y: number } {
  return { x: cx + ((i % 3) - 1) * GRID_CELL, y: cy + (Math.floor(i / 3) - 1) * GRID_CELL };
}

/** Is (x, y) on one of the two hydrant squares? */
export function onHydrant(grid: { cells: [number, number]; cx: number; cy: number }, x: number, y: number): boolean {
  return grid.cells.some((c) => {
    const p = gridCellCenter(grid.cx, grid.cy, c);
    return Math.abs(x - p.x) < GRID_CELL / 2 && Math.abs(y - p.y) < GRID_CELL / 2;
  });
}

/** Turn a freshly made enemy into the family's boss. */
export function makeBoss(id: number, x: number, y: number, seed: number, family: FamilyId, spawnRng: { int(a: number, b: number): number }, planet?: number): Enemy {
  const boss = BOSS_OF[family];
  const def = BOSSES[boss];
  const e = makeEnemy(id, x, y, seed, family);
  const asm = assembleBoss(boss, seed);
  e.boss = true;
  e.elite = undefined;
  e.defect = undefined;
  e.escalateIn = undefined;
  e.r = asm.radius;
  const variant = bossVariantOf(planet);
  const mine = variant && variant.boss === boss ? variant : undefined;
  e.hp = e.hpMax = mine ? mine.hp : def.hp;
  if (mine) variantLines.set(e, mine.lineKey);
  e.speed = def.speed;
  e.attackRange = def.attackRange;
  e.attackCooldown = def.attackCooldown;
  e.attackTimer = 1;
  e.damageType = FAMILY_DEFS[family].damageType;
  e.stats = { ...e.stats, pewnoscSiebie: def.pewnoscSiebie, upor: def.upor, dmgMin: def.dmgMin, dmgMax: def.dmgMax, critChance: 0.08 };
  e.claim = { textKey: `enemies.claim.boss.${boss}`, type: def.claimType };
  e.tier = asm.tier;
  const rt = (e.rt = newRt());
  rt.baseSpeed = def.speed;
  rt.baseCooldown = def.attackCooldown;
  rt.baseDmg = { min: def.dmgMin, max: def.dmgMax };
  rt.shootT = 2;
  rt.volleyT = 3;
  rt.summonT = SUMMON_EVERY_S;
  if (boss === 'hipoteza') {
    e.existence = BOSS_HIPOTEZA_E;
    rt.eTarget = BOSS_HIPOTEZA_E;
  } else e.existence = undefined;
  if (boss === 'weryfikacja') {
    const cells = [0, 1, 2, 3, 5, 6, 7, 8];
    const a = cells.splice(spawnRng.int(0, cells.length - 1), 1)[0] ?? 0;
    const b = cells[spawnRng.int(0, cells.length - 1)] ?? 8;
    rt.grid = { cells: [a, b], time: 0, cx: x, cy: y };
  }
  return e;
}

/** Put a boss at (x, y) without any placement checks (tests, screenshots). */
export function placeBoss(s: RunState, family: FamilyId, x: number, y: number): Enemy {
  const e = makeBoss(nextId(s), x, y, s.rngs.spawn.int(1, 1e6), family, s.rngs.spawn, s.plan?.planet);
  rtOf(e).sporAt = s.time + SPOR_FIRST_S;
  s.enemies.push(e);
  return e;
}

/** Put the family's boss on the page, far from the player. B4 calls this on the last page. */
export function spawnBoss(s: RunState, family: FamilyId | string): Enemy | null {
  const fam = FAMILY_IDS.find((f) => f === family);
  if (!fam) return null;
  const r = s.rngs.spawn;
  for (let tries = 0; tries < 60; tries++) {
    const x = r.range(260, s.page.w - 260);
    const y = r.range(260, s.page.h * 0.6);
    if (Math.hypot(x - s.player.x, y - s.player.y) < 420) continue;
    const e = makeBoss(nextId(s), x, y, r.int(1, 1e6), fam, r, s.plan?.planet);
    const before = { x: e.x, y: e.y };
    resolveMove(s.page, e, e.r + 80);
    if (Math.hypot(e.x - before.x, e.y - before.y) > 1) continue;
    e.home = { x, y };
    rtOf(e).sporAt = s.time + SPOR_FIRST_S;
    s.enemies.push(e);
    return e;
  }
  return null;
}

/** Per step for a boss (called from the enemy AI, before it moves). */
export function tickBoss(s: RunState, e: Enemy, bus: Bus, dt: number): void {
  const rt = rtOf(e);
  const p = s.player;
  const boss = BOSS_OF[e.family];
  // the first comment (DESIGN 5.4): 1.5 s after the boss is on the page, even if it is stunned
  if (rt.sporAt !== undefined && s.time >= rt.sporAt) {
    rt.sporAt = undefined;
    postSpor(s, bus, e, 1);
  }
  if (isStunned(e)) return;
  if (boss === 'prototyp') {
    if (rt.phase === 1 && e.hp <= e.hpMax / 2) {
      rt.phase = 2;
      rt.speedMul = 1.45;
      bus.emit('footnote', { text: t('enemies.boss.prototyp.half') });
      bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
      postSpor(s, bus, e, 2);
    }
  } else if (boss === 'weryfikacja') {
    const g = rt.grid;
    if (!rt.noted && Math.hypot(p.x - e.x, p.y - e.y) < 460) {
      rt.noted = true;
      bus.emit('footnote', { text: t('enemies.boss.weryfikacja.hint') });
    }
    if (g && !p.suspended && onHydrant(g, p.x, p.y)) {
      g.time += dt;
      if (g.time >= GRID_NEED_S) {
        g.time = 0;
        applyStatus(e, 'zablokowany', GRID_BLOCK_S, p.id);
        bus.emit('footnote', { text: t('enemies.boss.weryfikacja.solved') });
        bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
        postSpor(s, bus, e, 2);
      }
    }
    if (!isSilenced(e) && !s.law.botTime) {
      rt.summonT -= dt;
      if (rt.summonT <= 0) {
        rt.summonT = SUMMON_EVERY_S;
        const alive = s.enemies.filter((o) => o.family === 'powiadomienia' && !o.boss).length;
        for (let i = 0; i < 2 && alive + i < SUMMON_CAP; i++) {
          const a = s.rngs.spawn.range(0, Math.PI * 2);
          placeEnemy(s, 'powiadomienia', e.x + Math.cos(a) * (e.r + 40), e.y + Math.sin(a) * (e.r + 40), { tier: 1 });
        }
      }
    }
  } else {
    if (!rt.confirmed) {
      e.existence = BOSS_HIPOTEZA_E;
      if (!p.suspended && Math.hypot(p.x - e.x, p.y - e.y) < CONFIRM_R) rt.confirm += dt;
      else rt.confirm = Math.max(0, rt.confirm - dt * 0.5);
      if (rt.confirm >= CONFIRM_NEED_S) {
        rt.confirmed = true;
        e.existence = 1;
        rt.atkSpeed = 1.5;
        rt.speedMul = 1.4;
        bus.emit('footnote', { text: t('enemies.boss.hipoteza.confirmed') });
        bus.emit('stamp', { text: t('combat.verified'), x: e.x, y: e.y - 70 });
        bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
        postSpor(s, bus, e, 2);
      }
    } else e.existence = 1;
  }
}
