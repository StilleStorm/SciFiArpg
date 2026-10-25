/**
 * What the Konsultant's skills 6 to 10 and his passives 8 to 10 do from step to step (docs/SKILLS.md section 2), run by the hero
 * system through `HeroQuirk.tick`: the forms and the cages, the music and the chairs, the timers of the phone, the numbered queue,
 * the recordings on the floor. Everything lives in `konsultant/state.ts`; with none of it in use the tick returns at once.
 * (His rule, passive 7, Dostep do systemu, is `traits` in def.ts: it is always on.)
 */
import type { Claim } from '../../combat/claims';
import { DAMAGE_TYPES } from '../../combat/damage';
import { getStatus } from '../../combat/status';
import type { Bus } from '../../core/events';
import { recomputeStats } from '../../items/stats';
import type { RunState } from '../../world/run';
import { enemiesWithin, skillDamage, touchStatus } from '../helpers';
import type { HeroQuirk } from '../module';
import { buff, zone } from '../primitives';
import { NAGRANIE_R, NAGRANIE_S, NUMEREK_MAX, NUMEREK_S, NUMEREK_STEP, OPLATY_MAX, OPLATY_STEP, PRZERWA_STRIKE_R } from './numbers';
import { carriesHis, konsState, konsStateIfAny, type KonsState } from './state';

/** Passive 10: the share by which the kiosk's fee is cut this run (0 without the passive). */
export function priceCut(s: RunState): number {
  if ((s.hero.upgrades['passive10'] ?? 0) <= 0) return 0;
  return Math.min(OPLATY_MAX, OPLATY_STEP * (konsStateIfAny(s)?.asked ?? 0));
}

const taken = (s: RunState, id: string): boolean => (s.hero.upgrades[id] ?? 0) > 0;

function stepTimers(s: RunState, bus: Bus, k: KonsState): void {
  if (k.timers.length === 0) return;
  const due = k.timers.filter((t) => t.at <= s.time);
  if (due.length === 0) return;
  k.timers = k.timers.filter((t) => t.at > s.time);
  for (const t of due) t.run(s, bus);
}

/** Formularz kontaktowy: whoever stands on it is slowed and takes its share each whole second. */
function stepForms(s: RunState, bus: Bus, k: KonsState, dt: number): void {
  if (k.forms.size === 0) return;
  for (const [id, info] of k.forms) {
    const z = s.zones.find((x) => x.id === id);
    if (!z) {
      k.forms.delete(id);
      continue;
    }
    const inside = enemiesWithin(s, z.x, z.y, z.r);
    for (const e of inside) touchStatus(e, 'do_weryfikacji', 0.6, id);
    z.acc = (z.acc ?? 0) + dt;
    if (z.acc >= 1 - 1e-6) {
      z.acc -= 1;
      for (const e of inside) skillDamage(s, bus, e, info.type, info.dmg);
    }
  }
}

/** "Pole obowiazkowe": the ones inside at the cast are held on the circle. */
function stepCages(s: RunState, k: KonsState): void {
  if (k.cages.length === 0) return;
  k.cages = k.cages.filter((c) => s.time < c.until);
  for (const c of k.cages) {
    for (const id of c.ids) {
      const e = s.enemies.find((x) => x.id === id);
      if (!e) continue;
      const lim = Math.max(4, c.r - e.r * 0.5);
      const d = Math.hypot(e.x - c.x, e.y - c.y);
      if (d <= lim) continue;
      e.x = c.x + ((e.x - c.x) / d) * lim;
      e.y = c.y + ((e.y - c.y) / d) * lim;
    }
  }
}

/** Muzyka w sluchawce: the stave follows him, the ones within are marked; when it stops the resist goes back. */
function stepAura(s: RunState, k: KonsState): void {
  const a = k.aura;
  if (!a) return;
  const p = s.player;
  if (s.time >= a.until) {
    for (const type of DAMAGE_TYPES) p.baseStats.stats.resist[type] = (p.baseStats.stats.resist[type] ?? 0) - a.added;
    recomputeStats(p);
    k.aura = null;
    return;
  }
  for (const z of s.zones) {
    if (z.variant === 'stave') {
      z.x = p.x;
      z.y = p.y;
    }
  }
  for (const e of enemiesWithin(s, p.x, p.y, a.r)) {
    touchStatus(e, 'do_weryfikacji', 0.6, p.id);
    if (a.status) touchStatus(e, a.status.kind, a.status.seconds, p.id);
  }
}

/** Przerwa techniczna: the chair holds whoever is near, and strikes back at whoever touches it (§ 3). */
function stepChairs(s: RunState, bus: Bus, k: KonsState): void {
  if (k.chairs.size === 0) return;
  for (const [id, chair] of k.chairs) {
    const m = s.summons.find((x) => x.id === id);
    if (!m) {
      k.chairs.delete(id);
      continue;
    }
    for (const e of enemiesWithin(s, m.x, m.y, chair.pullR)) touchStatus(e, 'przeczytane', 0.4, id);
    if (chair.strike > 0 && s.time >= chair.next) {
      chair.next = s.time + 1;
      for (const e of enemiesWithin(s, m.x, m.y, PRZERWA_STRIKE_R)) skillDamage(s, bus, e, chair.type, chair.strike);
    }
  }
}

// ---------- passives 8 and 9 ----------

function setCrit(s: RunState, bus: Bus, k: KonsState, to: number): void {
  if (to === k.critAdded) return;
  buff({ s, bus }, 'critChance', to - k.critAdded);
  k.critAdded = to;
}

/** Numerek: whoever he gives a status is numbered; a kill that takes the lowest number left adds a step of crit, a kill out of order drops the chain. */
function stepNumerek(s: RunState, bus: Bus, k: KonsState, died: readonly number[]): void {
  for (const e of s.enemies) if (!k.numbered.has(e.id) && carriesHis(s, k, e)) k.numbered.set(e.id, k.nextNumber++);
  for (const id of died) {
    const n = k.numbered.get(id);
    if (n === undefined) continue;
    k.numbered.delete(id);
    let lowest = true;
    for (const other of k.numbered.values()) if (other < n) lowest = false;
    k.chain = lowest ? k.chain + 1 : 0;
    setCrit(s, bus, k, Math.min(NUMEREK_MAX, NUMEREK_STEP * k.chain));
    k.critUntil = s.time + NUMEREK_S;
  }
  if (k.critAdded > 0 && s.time >= k.critUntil) {
    setCrit(s, bus, k, 0);
    k.chain = 0;
  }
}

/** Polaczenie nagrywane: a blocked enemy that dies leaves its bubble on the floor for 3 s; the next enemy to step on it takes the claim. */
function stepNagranie(s: RunState, bus: Bus, k: KonsState, died: readonly number[]): void {
  for (const id of died) {
    const was = k.blocked.get(id);
    if (!was) continue;
    const z = zone({ s, bus }, { variant: 'nagranie', x: was.x, y: was.y, r: NAGRANIE_R, ttl: NAGRANIE_S, own: true });
    k.tapes.set(z.id, was.claim);
  }
  for (const [id, claim] of k.tapes) {
    const z = s.zones.find((x) => x.id === id);
    if (!z) {
      k.tapes.delete(id);
      continue;
    }
    const taker = s.enemies.find((e) => !e.boss && Math.hypot(e.x - z.x, e.y - z.y) <= NAGRANIE_R + e.r);
    if (!taker) continue;
    taker.claim = { textKey: claim.textKey, type: claim.type };
    z.ttl = 0;
    k.tapes.delete(id);
  }
  k.blocked.clear();
  for (const e of s.enemies) if (e.claim && getStatus(e, 'zablokowany')) k.blocked.set(e.id, { x: e.x, y: e.y, claim: { ...e.claim } as Claim });
}

/** Which enemies fell since the last step: ids that vanished while the kill count rose (a page turn clears the page without a kill). */
function diedSince(s: RunState, k: KonsState): number[] {
  const now = new Set<number>();
  for (const e of s.enemies) now.add(e.id);
  const out: number[] = [];
  const kills = s.kills - k.kills;
  if (kills > 0) for (const id of k.alive) if (!now.has(id)) out.push(id);
  k.alive = now;
  k.kills = s.kills;
  return out.length > kills ? out.slice(0, kills) : out;
}

export const quirk: HeroQuirk = {
  tick(s, bus) {
    const k = konsStateIfAny(s);
    const numerek = taken(s, 'passive8');
    const nagranie = taken(s, 'passive9');
    if (!k && !numerek && !nagranie) return;
    const st = k ?? konsState(s);
    stepTimers(s, bus, st);
    const dt = Math.min(0.1, Math.max(0, s.time - st.last));
    st.last = s.time;
    stepForms(s, bus, st, dt);
    stepCages(s, st);
    stepAura(s, st);
    stepChairs(s, bus, st);
    if (numerek || nagranie) {
      const died = diedSince(s, st);
      if (numerek) stepNumerek(s, bus, st, died);
      if (nagranie) stepNagranie(s, bus, st, died);
    }
  },
  priceCut,
};
