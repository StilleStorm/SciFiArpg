/** The casts of the Konsultant Infolinii, each a list of primitive calls (heroes/primitives). */
import { applyStatus } from '../../combat/status';
import { DAMAGE_TYPES } from '../../combat/damage';
import { recomputeStats } from '../../items/stats';
import { applyDamage, killEnemy } from '../../systems/combat';
import { fitAim, pickTarget, reachOf, resolveDirection, terenCentre } from '../aim';
import { t } from '../../i18n';
import { cast, firstCast } from '../cast';
import { countOf, durationOf, enemiesWithin, nearestEnemy, patchOf, power, reachMulOf, skillDamage, widthOf } from '../helpers';
import type { SkillFn } from '../module';
import { NUMER_S, NUMER_STAMP_DAMAGE, ROZLACZENIE_BELOW, ROZLACZENIE_BLOCK_S, ROZLACZENIE_DAMAGE, ROZLACZENIE_HALF, ROZLACZENIE_THROW } from '../numbers';
import { areaOf } from '../helpers';
import { buff, cone, fx, line, push, statusApply, summon, teleport, zone } from '../primitives';
import {
  FORMULARZ_CAGE_S,
  FORMULARZ_DPS,
  FORMULARZ_R,
  FORMULARZ_S,
  IX,
  MUZYKA_R,
  MUZYKA_REDUCTION,
  MUZYKA_S,
  ODDZWONIMY_BLOW_SHARE,
  ODDZWONIMY_DAMAGE,
  ODDZWONIMY_DELAY_S,
  ODDZWONIMY_HOLD_S,
  ODDZWONIMY_R,
  ODDZWONIMY_THROW,
  PRZERWA_PULL_R,
  PRZERWA_S,
  PRZERWA_STEP,
  ZGLOSZENIE_BOUNCE_R,
  ZGLOSZENIE_DAMAGE,
  ZGLOSZENIE_FAN_DEG,
  ZGLOSZENIE_HALF,
  ZGLOSZENIE_REACH,
} from './numbers';
import { konsState } from './state';

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
    if ((s.hero.upgrades['passive10'] ?? 0) > 0) konsState(s).asked++; // Wstrzymanie oplat (passive 10, heroes/konsultant/quirk.ts priceCut)
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

// ---------- skills 6 to 10 (docs/SKILLS.md section 2) ----------

/**
 * Zgloszenie przyjete: a ticket hits the target for 0.8x and bounces once to the nearest other enemy within 90 (a second, dotted
 * arc). § 2 zbiorcze: three tickets in a fan, each for 0.5x, no bounce. § 3 pilne: egzystencjalny, 1.3x, no bounce (reach 0).
 */
const zgloszenie = cast(IX.zgloszenie, [
  ({ c, s, bus, p, sk }) => {
    const i = IX.zgloszenie;
    const target = pickTarget(s, sk, { kind: 'auto' });
    if (!target) return false;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.konsultant.note.zgloszenie') });
    const mult = ZGLOSZENIE_DAMAGE * power(s, i);
    const d0 = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    const ux = (target.x - p.x) / d0;
    const uy = (target.y - p.y) / d0;
    const n = 1 + countOf(s, i);
    if (n === 1) {
      fx(c, 'line', p.x, p.y, 0, target.x, target.y);
      const from = { x: target.x, y: target.y };
      skillDamage(s, bus, target, sk.type, mult);
      const bounce = ZGLOSZENIE_BOUNCE_R * reachMulOf(s, i);
      let next = null as (typeof s.enemies)[number] | null;
      let best = bounce + 1e-6;
      for (const e of s.enemies) {
        if (e === target) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < best) {
          best = d;
          next = e;
        }
      }
      if (next) {
        fx(c, 'line', from.x, from.y, 0, next.x, next.y); // the second arc
        skillDamage(s, bus, next, sk.type, mult);
      }
      return;
    }
    const step = ((ZGLOSZENIE_FAN_DEG * widthOf(s, i)) * Math.PI) / 180;
    for (let k = 0; k < n; k++) {
      const a = (k - (n - 1) / 2) * step;
      const dx = ux * Math.cos(a) - uy * Math.sin(a);
      const dy = ux * Math.sin(a) + uy * Math.cos(a);
      const first = line(c, { x: p.x, y: p.y, dx, dy, reach: ZGLOSZENIE_REACH, half: ZGLOSZENIE_HALF })[0]?.e;
      const end = first ? { x: first.x, y: first.y } : { x: p.x + dx * ZGLOSZENIE_REACH * 0.6, y: p.y + dy * ZGLOSZENIE_REACH * 0.6 };
      fx(c, 'line', p.x, p.y, 0, end.x, end.y);
      if (first) skillDamage(s, bus, first, sk.type, mult);
    }
  },
]);

/**
 * Formularz kontaktowy: a ruled form on the page, 3 s: whoever stands on it is slowed (do_weryfikacji) and takes 0.3x a second
 * (heroes/konsultant/quirk.ts steps it). § 2 mechaniczny: the first enemy in it is zablokowany 1 s. § 3 pole obowiazkowe: none inside may leave for 1.5 s.
 */
const formularz = cast(IX.formularz, [
  ({ c, s, bus, sk, aim }) => {
    const i = IX.formularz;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.konsultant.note.formularz') });
    const at = terenCentre(s, sk, aim);
    const r = FORMULARZ_R * areaOf(s, i);
    const secs = FORMULARZ_S * durationOf(s, i);
    const k = konsState(s);
    const z = zone(c, { variant: 'formularz', x: at.x, y: at.y, r, ttl: secs, own: true, max: 2 });
    k.owned.add(z.id);
    k.forms.set(z.id, { dmg: FORMULARZ_DPS * power(s, i), type: sk.type });
    fx(c, 'ring', at.x, at.y, r);
    const inside = enemiesWithin(s, at.x, at.y, r).sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
    inside.forEach((e, n) => {
      if (n === 0) statusApply([e], { kind: 'do_weryfikacji', seconds: secs, source: z.id }); // the paragraph's marker lands on the first
      else applyStatus(e, 'do_weryfikacji', secs, z.id);
    });
    if (countOf(s, i) > 0) {
      const ids = inside.filter((e) => !e.boss).map((e) => e.id);
      if (ids.length > 0) k.cages.push({ x: at.x, y: at.y, r, until: s.time + FORMULARZ_CAGE_S, ids });
    }
  },
]);

/**
 * Muzyka w sluchawce: 4 s, a stave circles him; whoever is within 120 is do_weryfikacji and he takes 30% less of everything
 * (the resist is lifted by that much on every type and taken off again when the music stops). § 2 na zywo: egzystencjalny, r 180, 15% less.
 * § 3 cisza: 2 s, whoever is within 120 is wyciszony.
 */
const muzyka = cast(IX.muzyka, [
  ({ c, s, p }) => {
    const i = IX.muzyka;
    const k = konsState(s);
    const secs = MUZYKA_S * durationOf(s, i);
    const r = MUZYKA_R * areaOf(s, i);
    const points = Math.round(MUZYKA_REDUCTION * (patchOf(s, i)?.dmg ?? 1) * 100);
    if (k.aura) {
      // played again while it plays: the music goes on from now, the circle is as wide as the wider of the two
      k.aura.until = Math.max(k.aura.until, s.time + secs);
      k.aura.r = Math.max(k.aura.r, r);
    } else {
      for (const type of DAMAGE_TYPES) p.baseStats.stats.resist[type] = (p.baseStats.stats.resist[type] ?? 0) + points;
      recomputeStats(p);
      k.aura = { until: s.time + secs, r, added: points };
    }
    const status = patchOf(s, i)?.status;
    if (status) k.aura.status = status;
    else delete k.aura.status;
    for (const z of s.zones) if (z.variant === 'stave') z.ttl = 0;
    const z = zone(c, { variant: 'stave', x: p.x, y: p.y, r, ttl: secs, own: true });
    k.owned.add(z.id);
    fx(c, 'ring', p.x, p.y, r);
  },
]);

/**
 * Przerwa techniczna: he steps back 120 along the aim (a tap: away from the nearest enemy, or the way the stick points) and
 * leaves a chair where he stood; for 2 s whoever is within 100 reads it (przeczytane, so goes for the chair). § 2 dluzsza: the
 * chair stays 4 s, the step is 80. § 3 z winy klienta: regulaminowy; whoever touches the chair is struck for 0.6x a second.
 */
const przerwa = cast(IX.przerwa, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.przerwa;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.konsultant.note.przerwa') });
    const len = reachOf(s, sk) || PRZERWA_STEP;
    const a = fitAim(sk, aim);
    let dx: number;
    let dy: number;
    if (a.kind === 'kierunek' && Math.hypot(a.dx, a.dy) > 1e-6) {
      const l = Math.hypot(a.dx, a.dy);
      dx = a.dx / l;
      dy = a.dy / l;
    } else if (p.steer && p.steer.mag > 0) {
      dx = p.steer.dx;
      dy = p.steer.dy;
    } else {
      const near = nearestEnemy(s, p.x, p.y, 320);
      if (near) {
        const d = Math.hypot(near.x - p.x, near.y - p.y) || 1;
        dx = (p.x - near.x) / d;
        dy = (p.y - near.y) / d;
      } else {
        dx = -p.facing;
        dy = 0;
      }
    }
    const from = { x: p.x, y: p.y };
    teleport(c, { x: p.x + dx * len, y: p.y + dy * len, resolve: true });
    const k = konsState(s);
    const chair = summon(c, {
      variant: 'chair',
      heroId: p.heroId,
      x: from.x,
      y: from.y,
      ttl: PRZERWA_S * durationOf(s, i),
      damageMul: 0,
      speed: 0,
      attackRange: 0,
      max: 1,
    });
    k.owned.add(chair.id);
    k.chairs.set(chair.id, { pullR: PRZERWA_PULL_R * areaOf(s, i), strike: countOf(s, i) > 0 ? power(s, i) : 0, type: sk.type, next: s.time + 0.5 });
  },
]);

/**
 * Oddzwonimy: a phone is put down at the point; after 3 s it rings and whoever is within 110 reads it (przeczytane) and comes;
 * 1.6 s later it takes 1.2x from whoever has come. § 2 w ciagu 24 h: it rings after 1 s, radius 80. § 3 z innego numeru: mechaniczny;
 * the enemy nearest the phone is thrown 120 as it rings.
 */
const oddzwonimy = cast(IX.oddzwonimy, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.oddzwonimy;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.konsultant.note.oddzwonimy') });
    const at = terenCentre(s, sk, aim);
    const k = konsState(s);
    const delay = ODDZWONIMY_DELAY_S * (patchOf(s, i)?.dur ?? 1);
    const r = ODDZWONIMY_R * areaOf(s, i);
    const blow = ODDZWONIMY_DAMAGE * power(s, i);
    const throws = countOf(s, i) > 0;
    const phone = summon(c, { variant: 'phone', heroId: p.heroId, x: at.x, y: at.y, ttl: delay + ODDZWONIMY_HOLD_S + 0.4, damageMul: 0, speed: 0, attackRange: 0, settle: true, max: 1 });
    k.owned.add(phone.id);
    const type = sk.type;
    k.timers.push({
      at: s.time + delay,
      run(st, bus) {
        const ring = { s: st, bus };
        fx(ring, 'ring', phone.x, phone.y, r);
        for (const e of enemiesWithin(st, phone.x, phone.y, r)) {
          applyStatus(e, 'przeczytane', ODDZWONIMY_HOLD_S + 0.3, phone.id);
        }
        if (throws) {
          const near = nearestEnemy(st, phone.x, phone.y, r);
          if (near && !near.boss) {
            const d = Math.hypot(near.x - phone.x, near.y - phone.y) || 1;
            push(ring, near, (near.x - phone.x) / d || 1, (near.y - phone.y) / d, ODDZWONIMY_THROW, { mode: 'sweep' });
          }
        }
      },
    });
    k.timers.push({
      at: s.time + delay + ODDZWONIMY_HOLD_S,
      run(st, bus) {
        const ring = { s: st, bus };
        const reach = r * ODDZWONIMY_BLOW_SHARE;
        fx(ring, 'ring', phone.x, phone.y, reach);
        for (const e of enemiesWithin(st, phone.x, phone.y, reach)) skillDamage(st, bus, e, type, blow);
      },
    });
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { prosze, przekierowuje, pomoc, numer, rozlaczenie, zgloszenie, formularz, muzyka, przerwaTechniczna: przerwa, oddzwonimy };
