/** The casts of the Petlowiec, each a list of primitive calls (heroes/primitives). */
import type { DamageType } from '../../combat/damage';
import type { Enemy, Summon } from '../../entities/types';
import { t } from '../../i18n';
import type { Bus } from '../../core/events';
import type { RunState } from '../../world/run';
import { pickTarget, radiusOf, reachOf, terenCentre, type Aim } from '../aim';
import { cast, directionOf } from '../cast';
import { fireAuto } from '../auto';
import { skillAt, type HeroDef, type SkillIndex } from '../defs';
import { areaOf, countOf, durationOf, enemiesWithin, nearestEnemy, patchOf, power, skillDamage, widthOf } from '../helpers';
import { padOf } from '../loadout';
import type { SkillFn } from '../module';
import { DISAGREE_LINES, JUZ_SPREAD, MAX_COPIES, START_DELAY_S, TICK_S } from '../numbers';
import { aoe, forkProjectile, fx, heal, line, projectile, summon, teleport, zone, type Ctx } from '../primitives';
import { fire } from '../skills';
import { pushRing, ringBack } from '../state';
import { heroById } from '../registry';
import { readToward } from '../steps2';
import { resolveMove } from '../../world/pages';
import { bindPetl, copyBonus, copiesOf, refillCopies } from './quirk';
import {
  COPY_S,
  IX,
  OPOZNIENIE_S,
  OPOZNIENIE_SHARE,
  PARADOKS_ECHO,
  PARADOKS_MAX,
  PARADOKS_S,
  POWTORZENIE_DAMAGE,
  POWTORZENIE_HALF,
  POWTORZENIE_STAY_DPS,
  POWTORZENIE_STAY_S,
  UWAGA_COPY_RANGE,
  UWAGA_DAMAGE,
  UWAGA_FAN,
  UWAGA_SPEED,
  UWAGA_TTL,
  ZAMIANA_ENEMY_RANGE,
  ZAMIANA_R,
  ZAMIANA_READ_S,
} from './numbers';
import { petlState, type Clock } from './state';

/** Przybycie przed wyjazdem: a copy from another loop for 8 s (two at most). It disagrees in a footnote. */
const przybycie = cast(0, [
  ({ c, s, bus, p }) => {
    for (let k = 0; k <= countOf(s, 0); k++) {
      const angle = s.rngs.combat.range(0, Math.PI * 2);
      summon(c, {
        variant: 'copy',
        heroId: p.heroId,
        x: p.x + Math.cos(angle) * 34,
        y: p.y + Math.sin(angle) * 34,
        max: MAX_COPIES + s.hero.mods.summonMax,
        settle: true,
        ttl: 8 * durationOf(s, 0),
        damageType: p.damageType,
        attackRange: p.attackRange,
        attackCooldown: p.attackCooldown * 0.9,
        damageMul: 0.7 * power(s, 0),
        r: p.r,
        speed: p.speed * 0.9,
        facing: p.facing,
      });
    }
    bus.emit('footnote', { text: t(`heroes.petlowiec.disagree.${s.rngs.combat.int(1, DISAGREE_LINES)}`) });
  },
]);

/** Spor: every copy argues; an existential area around each (around the hero if there is no copy). */
const spor = cast(1, [
  ({ c, s, bus, p, sk }) => {
    const centers: { x: number; y: number }[] = s.summons.filter((x) => x.variant === 'copy').map((m) => ({ x: m.x, y: m.y }));
    const solo = centers.length === 0;
    if (solo) centers.push({ x: p.x, y: p.y });
    const radius = 85 * areaOf(s, 1);
    for (const at of centers) {
      fx(c, 'ring', at.x, at.y, radius);
      aoe(c, { x: at.x, y: at.y, r: radius, each: (e) => void skillDamage(s, bus, e, sk.type, (solo ? 0.9 : 1.3) * power(s, 1)) });
    }
  },
]);

/** Petla: back to where you were 3 s ago, with the racja you had then (if it was more). */
const petla = cast(2, [
  ({ c, s, p }) => {
    const then = ringBack(s.hero.ring, s.time, 3 * (patchOf(s, 2)?.dur ?? 1));
    if (!then) return false;
    teleport(c, { x: then.x, y: then.y });
    heal(c, { atLeast: then.hp });
    pushRing(s.hero.ring, { t: s.time, x: p.x, y: p.y, hp: p.hp });
    // passive 10, Zapasowa kapsula: the copies come back with him, with the whole of their stay
    if ((s.hero.upgrades['passive10'] ?? 0) > 0) refillCopies(s, COPY_S * durationOf(s, 0));
  },
]);

/** Skills a copy can cast at its own position by standing the player there for the cast: an area or a line from the caster. */
const COPY_CASTABLE: ReadonlySet<string> = new Set(['wirowanie', 'prosze', 'przekierowuje', 'triangulacja', 'beben', 'rozlaczenie', 'start', 'legenda', 'paradoks']);

/** A copy casts `skill` from where it stands (a point aim moves with it); the skills a copy cannot cast are skipped. */
function castFrom(s: RunState, bus: Bus, def: HeroDef, skill: SkillIndex, aim: Aim, at: { x: number; y: number }): void {
  const sk = skillAt(def, skill);
  const fn = COPY_CASTABLE.has(sk.id) ? heroById(def.id).casts[sk.id] : undefined;
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
const juzBylo = cast(3, [
  ({ c, s, bus, p, hero }) => {
    const last = s.hero.lastCast;
    if (!last) {
      const target = nearestEnemy(s, p.x, p.y, p.attackRange + 160);
      if (!target) return false;
      const before = s.projectiles.length;
      if (!fireAuto(s, p, target, bus)) return false;
      const shot = s.projectiles[before];
      if (shot) for (const turn of [-JUZ_SPREAD, JUZ_SPREAD]) forkProjectile(c, shot, turn);
      bus.emit('footnote', { text: t('heroes.petlowiec.alreadySaid') });
      return;
    }
    for (let k = 0; k <= countOf(s, 3); k++) {
      fire(s, bus, last.skill, padOf(s, last.skill) ?? 0, true, last.aim);
      for (const m of s.summons.filter((x) => x.variant === 'copy')) castFrom(s, bus, hero, last.skill, last.aim, { x: m.x, y: m.y });
    }
    if ((s.hero.noted & 8) === 0) {
      s.hero.noted |= 8;
      bus.emit('footnote', { text: t('heroes.petlowiec.alreadySaid') });
    }
  },
]);

/** Odlozony start: a countdown circle at the point; 0.8 s later the capsule lands (heroes/steps2.ts landStart). */
const start = cast(4, [
  ({ c, s, sk, aim }) => {
    const { x, y } = terenCentre(s, sk, aim);
    zone(c, { x, y, variant: 'start', r: radiusOf(s, sk), ttl: START_DELAY_S * (patchOf(s, 4)?.dur ?? 1) });
  },
]);

// ---------- S20: skills 6 to 10 ----------

/** One remark leaves (x, y) toward `target`; passive 8 may raise a copy's. */
function remark(c: Ctx, from: { x: number; y: number }, target: { x: number; y: number }, turn: number, damage: number, type: DamageType, copy: boolean): void {
  const s = c.s;
  const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
  const a = Math.atan2(target.y - from.y, target.x - from.x) + turn;
  const pr = projectile(c, {
    x: from.x,
    y: from.y,
    vx: Math.cos(a) * UWAGA_SPEED,
    vy: Math.sin(a) * UWAGA_SPEED,
    r: 5,
    ttl: Math.min(UWAGA_TTL, (d + 40) / UWAGA_SPEED),
    damage: damage * (copy ? copyBonus(s, type) : 1),
    damageType: type,
    pierce: 0,
  });
  petlState(s).seen.add(pr);
}

/**
 * Uwaga na marginesie: a remark at the auto target, and one from every copy at its own (§ 2 zbiorcza: all at his; § 3 nie na temat: only
 * his, 1.4x). A paragraph's or a set's `count` adds remarks to his own volley, fanned.
 */
const uwaga = cast(IX.uwaga, [
  ({ c, s, sk, aim, p }) => {
    const target = pickTarget(s, sk, aim);
    if (!target) return false;
    const dmg = UWAGA_DAMAGE * power(s, IX.uwaga);
    const extra = countOf(s, IX.uwaga);
    for (let k = 0; k <= extra; k++) {
      const turn = k === 0 ? 0 : Math.ceil(k / 2) * UWAGA_FAN * (k % 2 === 1 ? 1 : -1);
      remark(c, p, target, turn, dmg, sk.type, false);
    }
    if (sk.type === 'mechaniczny') return; // § 3: the copies do not repeat it
    const together = sk.type === 'regulaminowy'; // § 2: they all aim at his target
    for (const m of copiesOf(s)) {
      const own = together ? target : nearestEnemy(s, m.x, m.y, UWAGA_COPY_RANGE);
      if (own) remark(c, m, own, 0, dmg, sk.type, true);
    }
  },
]);

/** The ruled line from (x, y) along (dx, dy): the blow, and the sketch. */
function ruleFrom(e: { c: Ctx; s: RunState; bus: Bus }, at: { x: number; y: number }, dx: number, dy: number, reach: number, type: DamageType, mult: number): void {
  const { c, s, bus } = e;
  fx(c, 'line', at.x, at.y, 0, at.x + dx * reach, at.y + dy * reach);
  for (const { e: en } of line(c, { x: at.x, y: at.y, dx, dy, reach, half: POWTORZENIE_HALF * widthOf(s, IX.powtorzenie) })) skillDamage(s, bus, en, type, mult);
}

/**
 * Powtorzenie: a remark as a ruled line, 180 long, and each copy draws the same one from itself. § 2 dosłowne: regulaminowy, whoever
 * it hits is wyciszony for a second (the paragraph's status). § 3 w zapisie: `count` 1, the lines stay 2 s and strike 0.2x a second.
 */
const powtorzenie = cast(IX.powtorzenie, [
  (e) => {
    const { c, s, p, sk } = e;
    const { dx, dy } = directionOf(e);
    const reach = reachOf(s, sk);
    const stays = countOf(s, IX.powtorzenie) > 0;
    const mult = POWTORZENIE_DAMAGE * power(s, IX.powtorzenie);
    for (const at of [{ x: p.x, y: p.y }, ...copiesOf(s)]) {
      ruleFrom(e, at, dx, dy, reach, sk.type, mult);
      if (!stays) continue;
      const z = zone(c, { x: at.x, y: at.y, variant: 'zapis', r: reach, ttl: POWTORZENIE_STAY_S * durationOf(s, IX.powtorzenie), angle: Math.atan2(dy, dx), own: true, max: 8 });
      petlState(s).written.set(z.id, { x: at.x, y: at.y, dx, dy, reach, half: POWTORZENIE_HALF * widthOf(s, IX.powtorzenie), type: sk.type, tick: POWTORZENIE_STAY_DPS * TICK_S * power(s, IX.powtorzenie) });
    }
  },
]);

/**
 * Paradoks: a clock-face zone r 110 for 4 s at the aimed point; every hit that lands inside comes back 0.5 s later at 0.5x
 * (quirk.ts hears the hits). § 2 dziadka: mechaniczny, echo 0.8x, r 70. § 3 urzędowy: regulaminowy, whoever is inside is do weryfikacji.
 */
const paradoks = cast(IX.paradoks, [
  ({ c, s, bus, sk, aim }) => {
    bindPetl(bus, s);
    const { x, y } = terenCentre(s, sk, aim);
    const z = zone(c, { x, y, variant: 'paradoks', r: radiusOf(s, sk), ttl: PARADOKS_S * durationOf(s, IX.paradoks), own: true, max: PARADOKS_MAX });
    const st = petlState(s);
    const info: Clock = { share: PARADOKS_ECHO * power(s, IX.paradoks), type: sk.type };
    const marker = patchOf(s, IX.paradoks)?.status;
    if (marker) info.status = marker;
    st.clocks.set(z.id, info);
    fx(c, 'ring', x, y, z.r);
  },
]);

/**
 * Opóźnienie: for 3 s the damage he takes is logged and applied 3 s later, at half (the hit is given back at once; quirk.ts books it
 * and pays it, never below 1 racja). § 2 bezterminowe: 2 s, a quarter. § 3 z winy nadawcy: egzystencjalny, what is owed goes to the
 * nearest enemy instead.
 */
const opoznienie = cast(IX.opoznienie, [
  ({ c, s, bus, p, sk }) => {
    bindPetl(bus, s);
    const secs = OPOZNIENIE_S * durationOf(s, IX.opoznienie);
    petlState(s).delay = { until: s.time + secs, delay: secs, share: OPOZNIENIE_SHARE * (patchOf(s, IX.opoznienie)?.dmg ?? 1), toEnemy: sk.type === 'egzystencjalny', type: sk.type };
    fx(c, 'ring', p.x, p.y, p.r + 14);
    bus.emit('footnote', { text: t('heroes.petlowiec.delayNote') });
  },
]);

/**
 * Zamiana miejsc: he and the nearest copy change places; the enemies at his old spot are przeczytane toward the copy for 2 s. Nothing
 * happens with no copy. § 2 z przeciwnikiem: egzystencjalny, with the nearest enemy (not a boss) within 260 instead. § 3 planowa:
 * regulaminowy, the copy's stay is renewed and 25% longer.
 */
const zamiana = cast(IX.zamiana, [
  ({ c, s, p, sk }) => {
    const byEnemy = sk.type === 'egzystencjalny';
    const from = { x: p.x, y: p.y };
    let other: Enemy | Summon | undefined;
    if (byEnemy) {
      let best = ZAMIANA_ENEMY_RANGE + 1e-6;
      for (const en of s.enemies) {
        const d = Math.hypot(en.x - p.x, en.y - p.y);
        if (en.boss || d >= best) continue;
        best = d;
        other = en;
      }
    } else {
      let best = Infinity;
      for (const m of copiesOf(s)) {
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < best) {
          best = d;
          other = m;
        }
      }
    }
    if (!other) return false;
    const there = { x: other.x, y: other.y };
    fx(c, 'swap', from.x, from.y, 0, there.x, there.y);
    if (other.kind === 'summon') {
      if (sk.type === 'regulaminowy') other.ttl = Math.max(other.ttl, COPY_S * durationOf(s, IX.zamiana));
      for (const en of enemiesWithin(s, from.x, from.y, ZAMIANA_R)) readToward(en, ZAMIANA_READ_S, other.id);
    }
    p.x = there.x;
    p.y = there.y;
    p.target = null;
    resolveMove(s.page, p, p.r);
    other.x = from.x;
    other.y = from.y;
    resolveMove(s.page, other, other.r);
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { przybycie, spor, petla, juzBylo, start, uwaga, powtorzenie, paradoks, opoznienie, zamiana };
