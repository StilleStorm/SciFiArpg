/** The casts of the Petlowiec, each a list of primitive calls (heroes/primitives). */
import { t } from '../../i18n';
import type { Bus } from '../../core/events';
import type { RunState } from '../../world/run';
import { radiusOf, terenCentre, type Aim } from '../aim';
import { cast } from '../cast';
import { fireAuto } from '../auto';
import { skillAt, type HeroDef, type SkillIndex } from '../defs';
import { areaOf, countOf, durationOf, nearestEnemy, patchOf, power, skillDamage } from '../helpers';
import { padOf } from '../loadout';
import type { SkillFn } from '../module';
import { DISAGREE_LINES, JUZ_SPREAD, MAX_COPIES, START_DELAY_S } from '../numbers';
import { aoe, forkProjectile, fx, heal, summon, teleport, zone } from '../primitives';
import { fire } from '../skills';
import { pushRing, ringBack } from '../state';
import { heroById } from '../registry';

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
  },
]);

/** Skills a copy can cast at its own position by standing the player there for the cast: an area or a line from the caster. */
const COPY_CASTABLE: ReadonlySet<string> = new Set(['wirowanie', 'prosze', 'przekierowuje', 'triangulacja', 'beben', 'rozlaczenie', 'start', 'legenda']);

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

export const casts: Readonly<Record<string, SkillFn>> = { przybycie, spor, petla, juzBylo, start };
