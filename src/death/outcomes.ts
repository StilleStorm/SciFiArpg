/**
 * The three ways to lose all racja (DESIGN 9.1), chosen at random with the run's rng:
 * zgloszenie (the run ends), petla (back to the page start, a copy of you waits there),
 * zawieszenie (shadowbanned until the appeal form is filed). Logic only; forms are in ui/deathForms.ts.
 */
import { applyStatus } from '../combat/status';
import type { Bus } from '../core/events';
import type { Rng } from '../core/rng';
import { createEnemy, createSummon } from '../entities/factory';
import type { Enemy } from '../entities/types';
import type { CopySpec } from '../heroes/state';
import { allItems, type Item } from '../items';
import { t } from '../i18n';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';

export type DeathOutcome = 'zgloszenie' | 'petla' | 'zawieszenie';
export const DEATH_OUTCOMES: readonly DeathOutcome[] = ['zgloszenie', 'petla', 'zawieszenie'];

export const GHOST_SECONDS = 10;
const ARGUE_LINES = 3;

/** Equal chances; a suspended player who dies again always gets a zgloszenie. */
export function pickOutcome(rng: Rng, suspended: boolean): DeathOutcome {
  if (suspended) return 'zgloszenie';
  return rng.pick(DEATH_OUTCOMES);
}

/** The outcome for the player's next death in this run: depends only on the seed and how often they died. */
export function chooseOutcome(s: RunState): DeathOutcome {
  return pickOutcome(s.rng.fork(`death:${s.hero.deaths}`), s.player.suspended);
}

/** One of the items the player carries or wears, for the copy to drop. */
export function pickDrop(s: RunState, rng: Rng): Item | null {
  const items = allItems(s.player);
  return items.length > 0 ? rng.pick(items) : null;
}

/** What the player is at this moment, to be left behind. */
export function freezeCopy(s: RunState, rng: Rng): CopySpec {
  const p = s.player;
  return {
    heroId: p.heroId,
    level: p.level,
    x: p.x,
    y: p.y,
    stats: { ...p.stats, resist: { ...p.stats.resist } },
    damageType: p.damageType,
    hpMax: p.hpMax,
    speed: p.speed,
    r: p.r,
    attackRange: p.attackRange,
    attackCooldown: p.attackCooldown,
    drop: pickDrop(s, rng),
  };
}

/** The hostile copy: an Enemy that carries the hero's stats and drops one of the hero's items. */
export function spawnHostileCopy(s: RunState, bus: Bus, c: CopySpec, x = c.x, y = c.y): Enemy {
  const e = createEnemy(nextId(s), x, y, 1000 + c.level * 7 + s.hero.deaths);
  e.r = c.r;
  e.hpMax = c.hpMax;
  e.hp = c.hpMax;
  e.speed = c.speed * 0.85;
  e.stats = { ...c.stats, resist: { ...c.stats.resist } };
  e.damageType = c.damageType;
  e.attackRange = c.attackRange;
  e.attackCooldown = c.attackCooldown;
  e.attackTimer = 1;
  e.copyOf = { heroId: c.heroId, level: c.level };
  e.home = { x, y };
  if (c.drop) {
    e.drops = c.drop;
    s.hero.copyDrops.push({ enemyId: e.id, item: c.drop });
  }
  resolveMove(s.page, e, e.r);
  s.enemies.push(e);
  bus.emit('footnote', { text: t(`heroes.copy.argue.${s.rngs.combat.int(1, ARGUE_LINES)}`) });
  return e;
}

/** Back to the start of the page with full racja; the old self stays behind as an enemy (or a friendly ghost first). */
export function applyPetla(s: RunState, bus: Bus): void {
  const p = s.player;
  const copy = freezeCopy(s, s.rngs.loot);
  respawn(s);
  bus.emit('footnote', { text: t('heroes.copy.spawn') });
  if (p.heroId === 'petlowiec') {
    const g = createSummon(nextId(s), copy.x, copy.y, {
      variant: 'ghost',
      heroId: copy.heroId,
      ttl: GHOST_SECONDS,
      damageType: copy.damageType,
      attackRange: copy.attackRange,
      attackCooldown: copy.attackCooldown,
      damageMul: 0.9,
      r: copy.r,
      speed: copy.speed,
    });
    s.summons.push(g);
    s.hero.ghosts.push({ id: g.id, copy });
    bus.emit('footnote', { text: t('heroes.copy.friendly') });
  } else {
    spawnHostileCopy(s, bus, copy);
  }
}

/** A friendly ghost ran out of time: it changes its mind. */
export function ghostExpired(s: RunState, bus: Bus, summonId: number): void {
  const i = s.hero.ghosts.findIndex((g) => g.id === summonId);
  const g = s.hero.ghosts[i];
  if (i < 0 || !g) return;
  s.hero.ghosts.splice(i, 1);
  const spec = g.copy;
  const at = s.summons.find((m) => m.id === summonId);
  spawnHostileCopy(s, bus, spec, at?.x ?? spec.x, at?.y ?? spec.y);
  bus.emit('footnote', { text: t('heroes.copy.turned') });
}

/** Shadowbanned: enemies ignore the player, no pickups, -30% damage, until the appeal form is filed. */
export function applyZawieszenie(s: RunState, bus: Bus): void {
  respawn(s, false);
  s.player.suspended = true;
  s.hero.appealOwed = true;
  s.hero.suspendedAtKills = s.kills;
  bus.emit('footnote', { text: t('forms.death.zawieszenie.lead') });
}

function respawn(s: RunState, toSpawn = true): void {
  const p = s.player;
  p.hp = p.hpMax;
  p.shield = 0;
  p.statuses.length = 0;
  p.target = null;
  p.moving = false;
  s.hero.dash = null;
  s.hero.ring = [];
  if (toSpawn) {
    p.x = s.page.spawn.x;
    p.y = s.page.spawn.y;
  }
  // everyone near the spot calms down for a moment so the player is not killed on arrival
  for (const e of s.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < 160) applyStatus(e, 'zablokowany', 1, null);
  }
  s.status = 'running';
}

/** When a copy dies it drops the hero's item where it fell. Returns the item or null. */
export function takeCopyDrop(s: RunState, enemyId: number): Item | null {
  const i = s.hero.copyDrops.findIndex((d) => d.enemyId === enemyId);
  const d = s.hero.copyDrops[i];
  if (i < 0 || !d) return null;
  s.hero.copyDrops.splice(i, 1);
  return d.item;
}
