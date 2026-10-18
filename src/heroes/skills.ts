/** The fifteen skills as functions on the run state. Cooldowns only, no mana. Returning false = nothing happened, no cooldown. */
import { applyStatus, isSilenced, isStunned } from '../combat/status';
import type { Bus } from '../core/events';
import { createSummon, createZone } from '../entities/factory';
import { t } from '../i18n';
import { recomputeStats } from '../items/stats';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import { heroDef, type HeroDef, type PadSlot, type SkillIndex } from './defs';
import { AUTO_AIM, blinkOf, fitAim, LINE_SPEED, LINE_TTL, pickTarget, radiusOf, reachOf, resolveAim, resolveDirection, takeQueuedAim, terenCentre, type Aim, type ResolvedAim } from './aim';
import { areaOf, cooldownOf, durationOf, enemiesWithin, nearestEnemy, power, skillDamage } from './helpers';
import { padOf } from './loadout';
import { FLAG_S, GRAVITY_R, GRAVITY_S, ORBITA_TIME } from './nalesnik';
import { JUZ_SPREAD } from './numbers';
import { SKILLS2 } from './skills2';
import { pushRing, ringBack } from './state';
import { fireAuto } from './auto';

/** `aim` is what the player aimed (heroes/aim.ts); a skill of the auto mode ignores it. */
export type SkillFn = (s: RunState, bus: Bus, hero: HeroDef, aim: Aim) => void | false;

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
const odwirowanie: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const a = resolveDirection(s, hero.skills[2], aim);
  const len = reachOf(s, hero.skills[2]);
  const time = 0.22;
  s.hero.dash = { dx: a.dx, dy: a.dy, left: time, speed: len / time, drag: a.target ? a.target.id : null, rank: s.hero.ranks[2] };
  fx(bus, 'dash', p.x, p.y, 0, p.x + a.dx * len, p.y + a.dy * len);
};

// ---------- Konsultant Infolinii ----------

/** Prosze czekac: the target is zablokowany for 1.5 s, an hourglass drawn over it. */
const prosze: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const target = pickTarget(s, hero.skills[0], aim);
  if (!target) return false;
  const secs = 1.5 * durationOf(s, 0);
  applyStatus(target, 'zablokowany', secs, p.id);
  s.zones.push(createZone(nextId(s), target.x, target.y - target.r - 18, { variant: 'hourglass', r: 14, ttl: secs, follow: target.id }));
  skillDamage(s, bus, target, hero.skills[0].type, 0.6 * power(s, 0));
};

/** Przekierowuje: a cone; enemies in it become zgloszony and hit each other for 3 s. */
const przekierowuje: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const a = resolveDirection(s, hero.skills[1], aim);
  const range = reachOf(s, hero.skills[1]);
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
const triangulacja: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const a = resolveDirection(s, hero.skills[0], aim);
  const speed = LINE_SPEED;
  s.projectiles.push({
    kind: 'projectile',
    id: nextId(s),
    x: p.x + a.dx * 14,
    y: p.y + a.dy * 14,
    r: 7,
    vx: a.dx * speed,
    vy: a.dy * speed,
    ttl: LINE_TTL * areaOf(s, 0),
    damage: power(s, 0),
    damageType: hero.skills[0].type,
    owner: 'player',
    pierce: 99,
    bonusPerPass: 0.35,
    passed: [],
  });
  const length = reachOf(s, hero.skills[0]);
  fx(bus, 'line', p.x, p.y, 0, p.x + a.dx * length, p.y + a.dy * length);
};

/** Teren nieistniejacy: a marked area. Inside, enemies are do_weryfikacji and Wygenerowane exist at 0.3 (systems/hero.ts). */
const teren: SkillFn = (s, _bus, hero, aim) => {
  const { x, y } = terenCentre(s, hero.skills[1], aim);
  const marks = s.zones.filter((z) => z.variant === 'teren');
  while (marks.length >= MAX_ZONES) {
    const old = marks.shift();
    if (old) s.zones.splice(s.zones.indexOf(old), 1);
  }
  s.zones.push(createZone(nextId(s), x, y, { variant: 'teren', r: 85 * areaOf(s, 1), ttl: 6 * durationOf(s, 1) }));
};

/** Korekta: a short blink toward the aimed point (a tap: where the hero walks, else ahead); a "blad pomiaru" decoy stays and draws the attention. */
const korekta: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const { dx, dy, len } = blinkOf(s, hero.skills[2], aim);
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

// ---------- Nalesnik ----------

/** Orbita: a roll along the line (heroes/nalesnik.ts steps it); the first enemy hit that survives becomes a satellite for 3 s. */
const orbita: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const a = resolveDirection(s, hero.skills[0], aim);
  const len = reachOf(s, hero.skills[0]);
  s.hero.roll = { dx: a.dx, dy: a.dy, left: ORBITA_TIME, speed: len / ORBITA_TIME, hit: [], rank: s.hero.ranks[0] };
  p.target = null;
  if (Math.abs(a.dx) > 0.2) p.facing = a.dx > 0 ? 1 : -1;
  fx(bus, 'dash', p.x, p.y, 0, p.x + a.dx * len, p.y + a.dy * len);
};

/** Grawitacja wlasna: for 2 s everything within 180 units, loot included, falls toward the hero (heroes/nalesnik.ts). */
const grawitacja: SkillFn = (s, bus) => {
  const p = s.player;
  const radius = GRAVITY_R * areaOf(s, 1);
  s.hero.gravity = { left: GRAVITY_S * durationOf(s, 1), radius, rim: [] };
  fx(bus, 'swirl', p.x, p.y, radius);
};

/** Wniosek o status: a flag at the point, one at a time; within its zone the pancake is officially a planet. */
const wniosek: SkillFn = (s, bus, hero, aim) => {
  const { x, y } = terenCentre(s, hero.skills[2], aim);
  for (let i = s.zones.length - 1; i >= 0; i--) if (s.zones[i]?.variant === 'wniosek') s.zones.splice(i, 1);
  const r = radiusOf(s, hero.skills[2]);
  s.zones.push(createZone(nextId(s), x, y, { variant: 'wniosek', r, ttl: FLAG_S * durationOf(s, 2), inside: [] }));
  fx(bus, 'ring', x, y, r);
};

// ---------- Petlowiec: Juz to bylo ----------

/** Skills a copy can cast at its own position by standing the player there for the cast: an area or a line from the caster. */
const COPY_CASTABLE: ReadonlySet<string> = new Set(['wirowanie', 'prosze', 'przekierowuje', 'triangulacja', 'beben', 'rozlaczenie', 'start', 'legenda']);

/** The aim as the skill resolved it: a concrete direction or point, so that the repeat does what the first cast did. */
function concreteAim(a: ResolvedAim): Aim {
  if (a.kind === 'kierunek') return { kind: 'kierunek', dx: a.dx, dy: a.dy };
  if (a.kind === 'wskazanie') return { kind: 'wskazanie', x: a.x, y: a.y };
  return AUTO_AIM;
}

/** A copy casts `skill` from where it stands (a point aim moves with it); the skills a copy cannot cast are skipped. */
function castFrom(s: RunState, bus: Bus, def: HeroDef, skill: SkillIndex, aim: Aim, at: { x: number; y: number }): void {
  const sk = def.skills[skill];
  const fn = COPY_CASTABLE.has(sk.id) ? SKILLS[sk.id] : undefined;
  if (!fn) return;
  const p = s.player;
  const ox = p.x;
  const oy = p.y;
  const shifted: Aim = aim.kind === 'wskazanie' ? { kind: 'wskazanie', x: aim.x + (at.x - ox), y: aim.y + (at.y - oy) } : aim;
  p.x = at.x;
  p.y = at.y;
  try {
    fn(s, bus, def, shifted);
  } finally {
    p.x = ox;
    p.y = oy;
  }
}

/**
 * Juz to bylo: the last skill cast (not this one) again, for free and with its last aim; every live copy casts it from its own
 * place. With nothing to repeat: the auto, three at once.
 */
const juzBylo: SkillFn = (s, bus, hero) => {
  const p = s.player;
  const last = s.hero.lastCast;
  if (!last) {
    const target = nearestEnemy(s, p.x, p.y, p.attackRange + 160);
    if (!target) return false;
    const before = s.projectiles.length;
    if (!fireAuto(s, p, target, bus)) return false;
    const shot = s.projectiles[before];
    if (shot) {
      for (const turn of [-JUZ_SPREAD, JUZ_SPREAD]) {
        const c = Math.cos(turn);
        const sn = Math.sin(turn);
        s.projectiles.push({ ...shot, id: nextId(s), vx: shot.vx * c - shot.vy * sn, vy: shot.vx * sn + shot.vy * c, passed: [] });
      }
    }
    bus.emit('footnote', { text: t('heroes.petlowiec.alreadySaid') });
    return;
  }
  fire(s, bus, last.skill, padOf(s, last.skill) ?? 0, true, last.aim);
  for (const c of s.summons.filter((x) => x.variant === 'copy')) castFrom(s, bus, hero, last.skill, last.aim, { x: c.x, y: c.y });
  if ((s.hero.noted & 8) === 0) {
    s.hero.noted |= 8;
    bus.emit('footnote', { text: t('heroes.petlowiec.alreadySaid') });
  }
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
  orbita,
  grawitacja,
  wniosek,
  ...SKILLS2,
  juzBylo,
};

export function removeSummon(s: RunState, bus: Bus, id: number): void {
  const i = s.summons.findIndex((x) => x.id === id);
  if (i < 0) return;
  s.summons.splice(i, 1);
  bus.emit('summon:expired', { id });
}

/**
 * Fire the skill on pad `slot` (0..2) if it is ready and the hero is not wyciszony. `free` skips the cooldown check and
 * does not start one (Pralka's blad programu, Juz to bylo). `aim` is the player's aim (heroes/aim.ts); left out it is the auto cast.
 * Returns true if the skill did something. Cooldowns are kept per skill (`s.hero.pads[slot]`), not per pad (DESIGN 10.1).
 */
export function castSkill(s: RunState, bus: Bus, slot: PadSlot, free = false, aim?: Aim): boolean {
  if (s.status !== 'running' || s.phase === 'base') return false; // the base has nobody to argue with: a pad tap there does nothing
  const p = s.player;
  const skill = s.hero.pads[slot];
  if (s.law.botTime || isStunned(p)) return false; // the bot hours: skills do nothing, no cooldown is spent
  if (!free) {
    if (s.hero.cd[skill] > 0) return false;
    if (isSilenced(p)) {
      if (s.time - s.hero.silenceNoteAt > 1.5) {
        s.hero.silenceNoteAt = s.time;
        bus.emit('margin:note', { text: t('heroes.silenced'), x: p.x, y: p.y - p.r - 30 });
      }
      return false;
    }
  }
  return fire(s, bus, skill, slot, free, aim ?? (free ? undefined : (takeQueuedAim(slot) ?? undefined)));
}

/**
 * Run skill `skill` as if pad `slot` had been pressed (the checks are castSkill's): the function, the cooldown unless free, the
 * `skill:cast` event, and the note of what was cast for Juz to bylo. A free cast takes the aim it is given (auto by default).
 */
function fire(s: RunState, bus: Bus, skill: SkillIndex, slot: PadSlot, free: boolean, aim: Aim | undefined): boolean {
  const def = heroDef(s.player.heroId);
  const sk = def.skills[skill];
  const fn = SKILLS[sk.id];
  if (!fn) return false;
  const aimed = fitAim(sk, aim ?? AUTO_AIM);
  const resolved = resolveAim(s, sk, aimed);
  if (fn(s, bus, def, aimed) === false) return false;
  if (!free) {
    const total = cooldownOf(s, skill, sk.cooldown);
    s.hero.cd[skill] = total;
    s.hero.cdTotal[skill] = total;
    if (sk.id !== 'juzBylo') s.hero.lastCast = { skill, aim: concreteAim(resolved) };
  }
  bus.emit('skill:cast', { slot, skill, free, aim: resolved });
  return true;
}
