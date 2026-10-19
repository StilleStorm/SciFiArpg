/** The casts of the Konsultant Infolinii, each a list of primitive calls (heroes/primitives). */
import { applyDamage, killEnemy } from '../../systems/combat';
import { pickTarget, reachOf, resolveDirection } from '../aim';
import { cast } from '../cast';
import { countOf, durationOf, enemiesWithin, power, skillDamage, widthOf } from '../helpers';
import type { SkillFn } from '../module';
import { NUMER_S, NUMER_STAMP_DAMAGE, ROZLACZENIE_BELOW, ROZLACZENIE_BLOCK_S, ROZLACZENIE_DAMAGE, ROZLACZENIE_HALF, ROZLACZENIE_THROW } from '../numbers';
import { areaOf } from '../helpers';
import { buff, cone, fx, line, push, statusApply, zone } from '../primitives';

/** Prosze czekac: the target is zablokowany for 1.5 s, an hourglass drawn over it. */
const prosze = cast(0, [
  ({ c, s, bus, p, sk, aim }) => {
    const target = pickTarget(s, sk, aim);
    if (!target) return false;
    const secs = 1.5 * durationOf(s, 0);
    statusApply([target], { kind: 'zablokowany', seconds: secs, source: p.id });
    zone(c, { x: target.x, y: target.y - target.r - 18, variant: 'hourglass', r: 14, ttl: secs, follow: target.id });
    skillDamage(s, bus, target, sk.type, 0.6 * power(s, 0));
    // paragraph: the nearest others to the first (within 120) are held as well
    const more = enemiesWithin(s, target.x, target.y, 120)
      .filter((e) => e !== target)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
      .slice(0, countOf(s, 0));
    for (const e of more) {
      statusApply([e], { kind: 'zablokowany', seconds: secs, source: p.id });
      zone(c, { x: e.x, y: e.y - e.r - 18, variant: 'hourglass', r: 14, ttl: secs, follow: e.id });
      skillDamage(s, bus, e, sk.type, 0.6 * power(s, 0));
    }
  },
]);

/** Przekierowuje: a cone; enemies in it become zgloszony and hit each other for 3 s. */
const przekierowuje = cast(1, [
  ({ c, s, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    const range = reachOf(s, sk);
    fx(c, 'cone', p.x, p.y, range, p.x + a.dx * range, p.y + a.dy * range);
    const secs = 3 * durationOf(s, 1);
    const hit = cone(c, {
      x: p.x,
      y: p.y,
      dx: a.dx,
      dy: a.dy,
      reach: range,
      half: ((40 * Math.PI) / 180) * widthOf(s, 1),
      each: (e) => {
        statusApply([e], { kind: 'zgloszony', seconds: secs, source: p.id });
        e.attackTimer = Math.max(e.attackTimer, secs);
        s.hero.redirects = s.hero.redirects.filter((r) => r.id !== e.id);
        s.hero.redirects.push({ id: e.id, until: s.time + secs, next: s.time + 0.3 });
      },
    });
    return hit.length > 0 ? undefined : false;
  },
]);

/** Czy moge jeszcze w czyms pomoc: +crit for 6 s, every kill during it drops a gwiazdka (heroes/layer.ts). */
const pomoc = cast(2, [
  ({ c, s }) => {
    if (s.hero.buffCrit === 0) {
      s.hero.buffCrit = 0.25;
      buff(c, 'critChance', s.hero.buffCrit);
    }
    s.hero.buffUntil = s.time + 6 * durationOf(s, 2);
  },
]);

/** Numer sprawy: a stamp on the target; for 6 s it takes +35% from everything (heroes/steps2.ts hands it over when it dies). */
const numer = cast(3, [
  ({ c, s, bus, sk, aim }) => {
    const target = pickTarget(s, sk, aim);
    if (!target) return false;
    skillDamage(s, bus, target, sk.type, NUMER_STAMP_DAMAGE * power(s, 3)); // before the number: the stamp itself takes no bonus
    if (!s.enemies.includes(target)) return;
    const secs = NUMER_S * durationOf(s, 3);
    const number = 1000 + s.rngs.combat.int(0, 8999);
    s.hero.numer = { id: target.id, until: s.time + secs, handovers: 0, number, x: target.x, y: target.y };
    zone(c, { x: target.x, y: target.y - target.r - 18, variant: 'numer', r: 14, ttl: secs, follow: target.id, number, max: 1 });
  },
]);

/** Rozlaczenie: the first enemy on the line is thrown 180 further and zablokowany 2 s; below 25% racja the call just drops. */
const rozlaczenie = cast(4, [
  ({ c, s, bus, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    const reach = reachOf(s, sk);
    const first = line(c, { x: p.x, y: p.y, dx: a.dx, dy: a.dy, reach, half: ROZLACZENIE_HALF * widthOf(s, 4) })[0]?.e;
    if (!first) return false;
    fx(c, 'cut', p.x, p.y, 0, first.x, first.y);
    if (!first.boss && first.hp < first.hpMax * ROZLACZENIE_BELOW) {
      // the call simply drops: a normal death with normal drops
      if (!s.law.botTime) {
        applyDamage(s, bus, first, first.hp, false, sk.type);
        if (s.enemies.includes(first)) killEnemy(s, bus, first);
      }
      return;
    }
    if (!first.boss) push(c, first, a.dx, a.dy, ROZLACZENIE_THROW * areaOf(s, 4), { mode: 'sweep' });
    if (skillDamage(s, bus, first, sk.type, ROZLACZENIE_DAMAGE * power(s, 4))) return;
    statusApply([first], { kind: 'zablokowany', seconds: ROZLACZENIE_BLOCK_S * durationOf(s, 4), source: p.id });
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { prosze, przekierowuje, pomoc, numer, rozlaczenie };
