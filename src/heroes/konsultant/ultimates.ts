/** The ultimates of the Konsultant Infolinii (S3): Przekazanie do dzialu. */
import { applyStatus } from '../../combat/status';
import type { Enemy } from '../../entities/types';
import { resolveMove } from '../../world/pages';
import { enemiesWithin, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { fx, push } from '../primitives';
import { defineUltimate, type UltEnv } from '../ultimateDefs';
import { ANKIETA_DAMAGE, ANKIETA_PLACE, ANKIETA_R, ANKIETA_RATE_S, ANKIETA_S, KONIEC_DAMAGE, KONIEC_FRONT, KONIEC_GAP, KONIEC_MAX, KONIEC_R, KONIEC_S, KONIEC_THROW } from './numbers';
import { carriesHis, konsState } from './state';

const DAMAGE = 0.8;
/** Where the first strike lands from, between the enemies, once a second. */
const REDIRECT_STEP_S = 0.8;

/**
 * Przekazanie do dzialu (regulaminowy, auto, 12): every enemy on the page is zgloszony and attacks the nearest other enemy for 5 s,
 * and takes 0.8x once. The only page-wide ultimate of the hero, and it acts through that status (and the redirect the skill
 * Przekierowuje uses). § 2: egzystencjalny, 3 s, 1.5x. § 3: 8 s, no damage, every death drops a gwiazdka.
 */
const przekazanie = defineUltimate('konsultant', {
  id: 'przekazanie',
  type: 'regulaminowy',
  seconds: 5,
  radius: null,
  pageWide: true,
  two: { patch: { type: 'egzystencjalny', dur: 0.6, dmg: 1.875, cost: 6 } },
  three: { patch: { dur: 1.6, dmg: 0, cost: 5 }, tune: { gwiazdka: 1 } },
  cast(e) {
    const { s, bus, p, u } = e;
    for (const en of [...s.enemies]) {
      if (u.dmg > 0 && skillDamage(s, bus, en, e.type, DAMAGE * u.dmg)) continue; // it fell to the hit
      if (!s.enemies.includes(en)) continue;
      applyStatus(en, 'zgloszony', u.dur, p.id);
      if (en.boss) continue;
      en.attackTimer = Math.max(en.attackTimer, u.dur);
      s.hero.redirects = s.hero.redirects.filter((r) => r.id !== en.id);
      s.hero.redirects.push({ id: en.id, until: s.time + u.dur, next: s.time + REDIRECT_STEP_S * 0.4 });
    }
    u.seen = s.kills; // the kills of the opening strike are not the ones the gwiazdki are paid for
  },
  tick({ s, p, u, tune }) {
    const fallen = s.kills - u.seen;
    u.seen = s.kills;
    if (fallen > 0 && tune('gwiazdka', 0) > 0) p.gwiazdki += fallen * tune('gwiazdka', 0);
  },
});


const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Koniec kolejki (mechaniczny, auto, 24): whoever within 220 carries a status of his (fewer than three: the nearest are put in the
 * queue) is pulled into a line before him and disconnected one by one over 2 s, each for 1.6x and thrown 160. A boss is not
 * pulled; if it carries his status it is disconnected once. § 2 odwrotna: the furthest first, 2.2x. § 3 regulaminowa: no throw,
 * zablokowany 3 s.
 */
const koniecKolejki = defineUltimate('konsultant', {
  id: 'koniecKolejki',
  level: 24,
  type: 'mechaniczny',
  seconds: KONIEC_S + 0.4,
  radius: KONIEC_R,
  two: { patch: { dmg: 1.375, cost: 6 }, tune: { reverse: 1 } },
  three: { patch: { type: 'regulaminowy', dur: 1.2, cost: 5 }, tune: { throw: 0, block: 3 } },
  cast(e) {
    const { s, p, u, c } = e;
    const k = konsState(s);
    const pool = s.enemies.filter((en) => distance(en, p) <= KONIEC_R + en.r).sort((a, b) => distance(a, p) - distance(b, p));
    const bosses = pool.filter((en) => en.boss && carriesHis(s, k, en));
    const walkers = pool.filter((en) => !en.boss);
    const queue: Enemy[] = walkers.filter((en) => carriesHis(s, k, en));
    for (const en of walkers) {
      if (queue.length >= Math.min(3, walkers.length)) break;
      if (!queue.includes(en)) queue.push(en); // put in the queue by him: marked as his
    }
    queue.sort((a, b) => distance(a, p) - distance(b, p));
    queue.length = Math.min(queue.length, KONIEC_MAX);
    const head = walkers[0] ?? pool[0];
    let dx = head ? head.x - p.x : p.facing;
    let dy = head ? head.y - p.y : 0;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const hold = e.tune('block', 0) > 0 ? e.tune('block', 0) : KONIEC_S + 0.2;
    queue.forEach((en, i) => {
      en.x = p.x + dx * (KONIEC_FRONT + KONIEC_GAP * i);
      en.y = p.y + dy * (KONIEC_FRONT + KONIEC_GAP * i);
      resolveMove(s.page, en, en.r);
      applyStatus(en, 'zablokowany', Math.max(hold, 0.4), p.id);
    });
    const order = e.tune('reverse', 0) > 0 ? [...queue].reverse() : queue;
    u.ids = order.map((en) => en.id);
    k.queue = { dx, dy, gap: KONIEC_S / Math.max(1, order.length) };
    u.acc = 0;
    for (const b of bosses) skillDamage(s, e.bus, b, e.type, KONIEC_DAMAGE * u.dmg);
    if (queue.length > 0) fx(c, 'line', p.x, p.y, 0, p.x + dx * (KONIEC_FRONT + KONIEC_GAP * queue.length), p.y + dy * (KONIEC_FRONT + KONIEC_GAP * queue.length));
  },
  tick(e, dt) {
    const { u } = e;
    if (u.ids.length === 0) return;
    const gap = konsState(e.s).queue.gap; // one by one: the queue is cleared by the end of KONIEC_S
    u.acc += dt;
    while (u.acc >= gap && u.ids.length > 0) {
      u.acc -= gap;
      disconnect(e, u.ids.shift());
    }
  },
  end(e) {
    for (const id of [...e.u.ids]) disconnect(e, id);
    e.u.ids = [];
  },
});

/** One call dropped: the hit, then the throw along the line (none in § 3). */
function disconnect(e: UltEnv, id: number | undefined): void {
  if (id === undefined) return;
  const { s, bus, p, u, c } = e;
  const en = s.enemies.find((x) => x.id === id);
  if (!en) return;
  fx(c, 'line', p.x, p.y, 0, en.x, en.y);
  if (skillDamage(s, bus, en, e.type, KONIEC_DAMAGE * u.dmg)) return;
  const throwBy = e.tune('throw', KONIEC_THROW);
  const line = konsState(s).queue;
  if (throwBy > 0 && !en.boss) push(c, en, line.dx, line.dy, throwBy, { mode: 'sweep' });
}

/**
 * Ankieta (egzystencjalny, auto, 36): a survey form of radius 160 is put down where most of them stand (within 200 of him);
 * whoever is on it is zablokowany 2 s while they rate the call, then takes 2.0x; a death on the form pays one more gwiazdka.
 * § 2: radius 100, 3.0x. § 3 obowiazkowa: regulaminowa; whoever is within 220 of the form is pulled onto it first.
 */
const ankieta = defineUltimate('konsultant', {
  id: 'ankieta',
  level: 36,
  type: 'egzystencjalny',
  seconds: ANKIETA_S,
  radius: ANKIETA_R,
  two: { patch: { dmg: 1.5, cost: 4 }, tune: { radius: 100 } },
  three: { patch: { type: 'regulaminowy', cost: 5 }, tune: { pull: 220 } },
  cast(e) {
    const { s, p, u, c } = e;
    const r = u.r ?? ANKIETA_R;
    // the place: the enemy within reach with the most others round it, else under his feet
    let at = { x: p.x, y: p.y };
    let best = -1;
    for (const en of s.enemies) {
      if (distance(en, p) > ANKIETA_PLACE) continue;
      const n = enemiesWithin(s, en.x, en.y, r * 0.6).length;
      if (n > best) {
        best = n;
        at = { x: en.x, y: en.y };
      }
    }
    u.x = at.x;
    u.y = at.y;
    const pull = e.tune('pull', 0);
    if (pull > 0) {
      for (const en of enemiesWithin(s, at.x, at.y, pull)) {
        if (en.boss) continue;
        const d = Math.hypot(en.x - at.x, en.y - at.y);
        if (d <= r * 0.8) continue;
        const k = (r * 0.8) / (d || 1);
        en.x = at.x + (en.x - at.x) * k;
        en.y = at.y + (en.y - at.y) * k;
        resolveMove(s.page, en, en.r);
      }
    }
    u.ids = enemiesWithin(s, at.x, at.y, r).map((en) => en.id);
    for (const id of u.ids) {
      const en = s.enemies.find((x) => x.id === id);
      if (en) applyStatus(en, 'zablokowany', ANKIETA_RATE_S, p.id);
    }
    u.acc = 0;
    u.seen = s.kills;
    fx(c, 'ring', at.x, at.y, r);
  },
  tick(e, dt) {
    const { s, bus, p, u } = e;
    // a death on the form pays a gwiazdka more; the ids of the fallen are dropped from the record once paid
    const fallen = u.ids.filter((id) => !s.enemies.some((x) => x.id === id));
    if (fallen.length > 0 && s.kills > u.seen) {
      p.gwiazdki += Math.min(fallen.length, s.kills - u.seen);
      u.seen = s.kills;
      u.ids = u.ids.filter((id) => !fallen.includes(id));
    }
    if (u.acc < 0) return;
    u.acc += dt;
    if (u.acc < ANKIETA_RATE_S) return;
    u.acc = -1e9; // rated
    for (const id of u.ids) {
      const en = s.enemies.find((x) => x.id === id);
      if (en) skillDamage(s, bus, en, e.type, ANKIETA_DAMAGE * u.dmg);
    }
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [przekazanie, koniecKolejki, ankieta];
