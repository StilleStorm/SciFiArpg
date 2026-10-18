/** The twelve skills as functions on the run state. Cooldowns only, no mana. Returning false = nothing happened, no cooldown. */
import { applyStatus, isSilenced, isStunned } from '../combat/status';
import type { Bus } from '../core/events';
import { createSummon, createZone } from '../entities/factory';
import { t } from '../i18n';
import { recomputeStats } from '../items/stats';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import { heroDef, type HeroDef } from './defs';
import { aim, areaOf, cooldownOf, durationOf, enemiesWithin, nearestEnemy, power, skillDamage } from './helpers';
import { pushRing, ringBack } from './state';

export type SkillFn = (s: RunState, bus: Bus, hero: HeroDef) => void | false;

const DISAGREE_LINES = 6;
const MAX_COPIES = 2;
const MAX_ZONES = 2;
export const FOAM_RADIUS = 44;

function fx(bus: Bus, kind: 'swirl' | 'foam' | 'cone' | 'ring' | 'line' | 'blink' | 'dash', x: number, y: number, r: number, x2 = x, y2 = y): void {
  bus.emit('skill:fx', { kind, x, y, x2, y2, r });
}

// ---------- Pralka Emancypowana ----------

/** Wirowanie: a spin around herself, pulling the nearest in. */
const wirowanie: SkillFn = (s, bus, hero) => {
  const p = s.player;
  const type = hero.skills[0].type;
  const radius = 96 * areaOf(s, 0);
  fx(bus, 'swirl', p.x, p.y, radius);
  for (const e of enemiesWithin(s, p.x, p.y, radius)) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    const pull = Math.max(0, Math.min(34 * s.law.knockbackMul, d - (p.r + e.r + 2)));
    e.x -= ((e.x - p.x) / d) * pull;
    e.y -= ((e.y - p.y) / d) * pull;
    resolveMove(s.page, e, e.r);
    skillDamage(s, bus, e, type, 1.4 * power(s, 0));
  }
};

/** Pranie wstepne: a foam shield for 5 s. Enemies that touch it are do_weryfikacji (see systems/hero.ts). */
const pranieWstepne: SkillFn = (s, bus) => {
  const p = s.player;
  const amount = (30 + 4 * p.level + s.hero.mods.shield) * (1 + 0.25 * s.hero.ranks[1]);
  p.shield = Math.round(amount);
  s.hero.shieldUntil = s.time + 5 * durationOf(s, 1);
  fx(bus, 'foam', p.x, p.y, FOAM_RADIUS);
};

/** Odwirowanie: a dash that drags one enemy along and drops it zablokowany. */
const odwirowanie: SkillFn = (s, bus) => {
  const p = s.player;
  const a = aim(s, 240);
  const len = 150 * areaOf(s, 2);
  const time = 0.22;
  s.hero.dash = { dx: a.dx, dy: a.dy, left: time, speed: len / time, drag: a.target ? a.target.id : null, rank: s.hero.ranks[2] };
  fx(bus, 'dash', p.x, p.y, 0, p.x + a.dx * len, p.y + a.dy * len);
};

// ---------- Konsultant Infolinii ----------

/** Prosze czekac: the target is zablokowany for 1.5 s, an hourglass drawn over it. */
const prosze: SkillFn = (s, bus, hero) => {
  const p = s.player;
  const target = nearestEnemy(s, p.x, p.y, 300 * areaOf(s, 0));
  if (!target) return false;
  const secs = 1.5 * durationOf(s, 0);
  applyStatus(target, 'zablokowany', secs, p.id);
  s.zones.push(createZone(nextId(s), target.x, target.y - target.r - 18, { variant: 'hourglass', r: 14, ttl: secs, follow: target.id }));
  skillDamage(s, bus, target, hero.skills[0].type, 0.6 * power(s, 0));
};

/** Przekierowuje: a cone; enemies in it become zgloszony and hit each other for 3 s. */
const przekierowuje: SkillFn = (s, bus) => {
  const p = s.player;
  const a = aim(s, 240);
  const range = 150 * areaOf(s, 1);
  const half = (40 * Math.PI) / 180;
  const base = Math.atan2(a.dy, a.dx);
  fx(bus, 'cone', p.x, p.y, range, p.x + a.dx * range, p.y + a.dy * range);
  const secs = 3 * durationOf(s, 1);
  let any = false;
  for (const e of s.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (Math.hypot(dx, dy) > range + e.r) continue;
    let diff = Math.atan2(dy, dx) - base;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > half) continue;
    any = true;
    applyStatus(e, 'zgloszony', secs, p.id);
    e.attackTimer = Math.max(e.attackTimer, secs);
    s.hero.redirects = s.hero.redirects.filter((r) => r.id !== e.id);
    s.hero.redirects.push({ id: e.id, until: s.time + secs, next: s.time + 0.3 });
  }
  return any ? undefined : false;
};

/** Czy moge jeszcze w czyms pomoc: +crit for 6 s, every kill during it drops a gwiazdka (systems/hero.ts). */
const pomoc: SkillFn = (s) => {
  const p = s.player;
  if (s.hero.buffCrit === 0) {
    s.hero.buffCrit = 0.25;
    p.baseStats.stats.critChance += s.hero.buffCrit;
    recomputeStats(p);
  }
  s.hero.buffUntil = s.time + 6 * durationOf(s, 2);
};

// ---------- Petlowiec ----------

/** Przybycie przed wyjazdem: a copy from another loop for 8 s (two at most). It disagrees in a footnote. */
const przybycie: SkillFn = (s, bus) => {
  const p = s.player;
  const copies = s.summons.filter((x) => x.variant === 'copy');
  const max = MAX_COPIES + s.hero.mods.summonMax;
  while (copies.length >= max) {
    const old = copies.shift();
    if (!old) break;
    removeSummon(s, bus, old.id);
  }
  const angle = s.rngs.combat.range(0, Math.PI * 2);
  const x = p.x + Math.cos(angle) * 34;
  const y = p.y + Math.sin(angle) * 34;
  const c = createSummon(nextId(s), x, y, {
    variant: 'copy',
    heroId: 'petlowiec',
    ttl: 8 * durationOf(s, 0),
    damageType: p.damageType,
    attackRange: p.attackRange,
    attackCooldown: p.attackCooldown * 0.9,
    damageMul: 0.7 * power(s, 0),
    r: p.r,
    speed: p.speed * 0.9,
    facing: p.facing,
  });
  resolveMove(s.page, c, c.r);
  s.summons.push(c);
  bus.emit('footnote', { text: t(`heroes.petlowiec.disagree.${s.rngs.combat.int(1, DISAGREE_LINES)}`) });
};

/** Spor: every copy argues; an existential area around each (around the hero if there is no copy). */
const spor: SkillFn = (s, bus, hero) => {
  const p = s.player;
  const centers: { x: number; y: number }[] = s.summons.filter((x) => x.variant === 'copy').map((c) => ({ x: c.x, y: c.y }));
  const solo = centers.length === 0;
  if (solo) centers.push({ x: p.x, y: p.y });
  const radius = 85 * areaOf(s, 1);
  for (const c of centers) {
    fx(bus, 'ring', c.x, c.y, radius);
    for (const e of enemiesWithin(s, c.x, c.y, radius)) skillDamage(s, bus, e, hero.skills[1].type, (solo ? 0.9 : 1.3) * power(s, 1));
  }
};

/** Petla: back to where you were 3 s ago, with the racja you had then (if it was more). */
const petla: SkillFn = (s, bus) => {
  const p = s.player;
  const then = ringBack(s.hero.ring, s.time, 3);
  if (!then) return false;
  fx(bus, 'blink', p.x, p.y, 0, then.x, then.y);
  p.x = then.x;
  p.y = then.y;
  p.target = null;
  p.hp = Math.min(p.hpMax, Math.max(p.hp, then.hp));
  pushRing(s.hero.ring, { t: s.time, x: p.x, y: p.y, hp: p.hp });
};

// ---------- Kartograf Planet Nieistniejacych ----------

/** Triangulacja: a line shot through everything; damage grows with every enemy passed. */
const triangulacja: SkillFn = (s, bus, hero) => {
  const p = s.player;
  const a = aim(s, 340);
  const speed = 680;
  s.projectiles.push({
    kind: 'projectile',
    id: nextId(s),
    x: p.x + a.dx * 14,
    y: p.y + a.dy * 14,
    r: 7,
    vx: a.dx * speed,
    vy: a.dy * speed,
    ttl: 0.62 * areaOf(s, 0),
    damage: power(s, 0),
    damageType: hero.skills[0].type,
    owner: 'player',
    pierce: 99,
    bonusPerPass: 0.35,
    passed: [],
  });
  fx(bus, 'line', p.x, p.y, 0, p.x + a.dx * speed * 0.62, p.y + a.dy * speed * 0.62);
};

/** Teren nieistniejacy: a marked area. Inside, enemies are do_weryfikacji and Wygenerowane exist at 0.3 (systems/hero.ts). */
const teren: SkillFn = (s) => {
  const p = s.player;
  const target = nearestEnemy(s, p.x, p.y, 300);
  const x = target ? target.x : p.x + p.facing * 110;
  const y = target ? target.y : p.y;
  const marks = s.zones.filter((z) => z.variant === 'teren');
  while (marks.length >= MAX_ZONES) {
    const old = marks.shift();
    if (old) s.zones.splice(s.zones.indexOf(old), 1);
  }
  s.zones.push(createZone(nextId(s), x, y, { variant: 'teren', r: 85 * areaOf(s, 1), ttl: 6 * durationOf(s, 1) }));
};

/** Korekta: a short blink toward the tapped point; a "blad pomiaru" decoy stays and draws the attention. */
const korekta: SkillFn = (s, bus) => {
  const p = s.player;
  const reach = 150 * areaOf(s, 2);
  let dx = p.facing;
  let dy = 0;
  let len = reach * 0.9;
  if (p.target) {
    const tx = p.target.x - p.x;
    const ty = p.target.y - p.y;
    const d = Math.hypot(tx, ty);
    if (d > 4) {
      dx = tx / d;
      dy = ty / d;
      len = Math.min(d, reach);
    }
  }
  const from = { x: p.x, y: p.y };
  const secs = 5 * durationOf(s, 2);
  const decoy = createSummon(nextId(s), from.x, from.y, {
    variant: 'decoy',
    heroId: 'kartograf',
    ttl: secs,
    damageMul: 0,
    damageType: s.player.damageType,
    r: p.r,
    facing: p.facing,
  });
  s.summons.push(decoy);
  p.x += dx * len;
  p.y += dy * len;
  resolveMove(s.page, p, p.r);
  p.target = null;
  fx(bus, 'blink', from.x, from.y, 0, p.x, p.y);
  for (const e of enemiesWithin(s, from.x, from.y, 190)) applyStatus(e, 'przeczytane', secs, decoy.id);
};

export const SKILLS: Record<string, SkillFn> = {
  wirowanie,
  pranieWstepne,
  odwirowanie,
  prosze,
  przekierowuje,
  pomoc,
  przybycie,
  spor,
  petla,
  triangulacja,
  teren,
  korekta,
};

export function removeSummon(s: RunState, bus: Bus, id: number): void {
  const i = s.summons.findIndex((x) => x.id === id);
  if (i < 0) return;
  s.summons.splice(i, 1);
  bus.emit('summon:expired', { id });
}

/**
 * Fire skill `slot` (0..2) if it is ready and the hero is not wyciszony. `free` skips the cooldown check and
 * does not start one (Pralka's blad programu). Returns true if the skill did something.
 */
export function castSkill(s: RunState, bus: Bus, slot: 0 | 1 | 2, free = false): boolean {
  if (s.status !== 'running' || s.phase === 'base') return false; // the base has nobody to argue with: a pad tap there does nothing
  const p = s.player;
  const def = heroDef(p.heroId);
  const sk = def.skills[slot];
  if (s.law.botTime || isStunned(p)) return false; // the bot hours: skills do nothing, no cooldown is spent
  if (!free) {
    if (s.hero.cd[slot] > 0) return false;
    if (isSilenced(p)) {
      if (s.time - s.hero.silenceNoteAt > 1.5) {
        s.hero.silenceNoteAt = s.time;
        bus.emit('margin:note', { text: t('heroes.silenced'), x: p.x, y: p.y - p.r - 30 });
      }
      return false;
    }
  }
  const fn = SKILLS[sk.id];
  if (!fn || fn(s, bus, def) === false) return false;
  if (!free) {
    const total = cooldownOf(s, slot, sk.cooldown);
    s.hero.cd[slot] = total;
    s.hero.cdTotal[slot] = total;
  }
  bus.emit('skill:cast', { slot, free });
  return true;
}
