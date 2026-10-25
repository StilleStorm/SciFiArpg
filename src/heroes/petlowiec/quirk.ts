/**
 * What the Pętlowiec's skills 6 to 10 and his passives 8 to 10 do from step to step (docs/SKILLS.md section 3), run by the hero
 * system through `HeroQuirk.tick`: the notes of where everyone stood (for Cofnięcie zgłoszenia), the echoes of Paradoks, the lines
 * Powtórzenie leaves standing, the hits Opóźnienie owes. Everything lives in `petlowiec/state.ts`. His rule, passive 7, Pętla po
 * śmierci, is `traits.friendlyCopy` in def.ts (death/outcomes.ts): it is always on.
 */
import type { DamageType } from '../../combat/damage';
import type { Bus } from '../../core/events';
import type { Summon } from '../../entities/types';
import { t } from '../../i18n';
import { applyDamage } from '../../systems/combat';
import type { RunState } from '../../world/run';
import { trackedRun, trackRun } from '../aim';
import { heroDef } from '../defs';
import { enemiesWithin, nearestEnemy, skillDamage, touchStatus } from '../helpers';
import { effectiveSkill } from '../loadout';
import type { HeroQuirk } from '../module';
import { TICK_S } from '../numbers';
import { line } from '../primitives';
import { ARGUE_LINES } from '../../death/outcomes';
import { DZIENNIK_EVERY, NIEZGODA_AFTER_S, PARADOKS_ECHO_DELAY_S, SNAP_KEEP_S, SNAP_STEP_S, SPRZECZNOSC_BONUS } from './numbers';
import { petlState, petlStateIfAny, type PetlState } from './state';

const taken = (s: RunState, id: string): boolean => (s.hero.upgrades[id] ?? 0) > 0;

/** The live copies of Przybycie przed wyjazdem (not the friendly ghost of the death). */
export const copiesOf = (s: RunState): Summon[] => s.summons.filter((m) => m.variant === 'copy');

/** Passive 10, Zapasowa kapsuła: every copy has the whole of `ttl` left again. */
export function refillCopies(s: RunState, ttl: number): void {
  for (const m of copiesOf(s)) m.ttl = Math.max(m.ttl, ttl);
}

/** The type of his last hit: the skill cast last, else his auto-attack. */
export function lastHitType(s: RunState): DamageType {
  const last = s.hero.lastCast;
  return last ? effectiveSkill(s, last.skill).type : heroDef(s.player.heroId).auto.type;
}

/** Passive 8, Sprzeczność: a copy's hit of a type other than his last hit deals 15% more (a factor on the hit). */
export function copyBonus(s: RunState, type: DamageType): number {
  return taken(s, 'passive8') && type !== lastHitType(s) ? 1 + SPRZECZNOSC_BONUS : 1;
}

// ---------- the events he listens to ----------

const bound = new WeakSet<object>();

/**
 * Listen, once per bus, to the hits taken (Opóźnienie logs them), the hits dealt (Paradoks echoes them) and the casts (Dziennik
 * pokładowy). The handlers read the run the hero system is stepping (`trackedRun`), never a closure over one run.
 */
export function bindPetl(bus: Bus, s?: RunState): void {
  if (s) trackRun(s);
  if (bound.has(bus)) return;
  bound.add(bus);
  bus.on('player:hit', (ev) => {
    const run = trackedRun();
    const st = run && petlStateIfAny(run);
    const d = st?.delay;
    if (!run || !st || !d || st.dealing || run.time >= d.until) return;
    // the blow is given back before the death check that follows this event: it is booked, and paid `delay` later
    run.player.hp = Math.min(run.player.hpMax, run.player.hp + ev.amount);
    st.owed.push({ at: run.time + d.delay, amount: ev.amount * d.share, toEnemy: d.toEnemy, type: d.type });
  });
  bus.on('enemy:hit', (ev) => {
    const run = trackedRun();
    const st = run && petlStateIfAny(run);
    if (!run || !st || st.dealing || st.clocks.size === 0) return;
    for (const z of run.zones) {
      const clock = z.variant === 'paradoks' ? st.clocks.get(z.id) : undefined;
      if (!clock || Math.hypot(ev.x - z.x, ev.y - z.y) > z.r) continue;
      const share = clock.share;
      st.timers.push({
        at: run.time + PARADOKS_ECHO_DELAY_S,
        run(r, b) {
          const e = r.enemies.find((x) => x.id === ev.id);
          if (!e) return;
          st.dealing = true;
          try {
            applyDamage(r, b, e, Math.max(1, Math.round(ev.amount * share)), false, clock.type, false);
          } finally {
            st.dealing = false;
          }
        },
      });
      return; // one echo per hit, however many clocks stand over it
    }
  });
  // passive 7 (the rule, always on): a copy that outlives him by two seconds disagrees with the record in a footnote
  bus.on('player:died', () => {
    const run = trackedRun();
    if (!run || run.player.heroId !== 'petlowiec') return;
    const ids = copiesOf(run).map((m) => m.id);
    if (ids.length === 0) return;
    petlState(run).timers.push({
      at: run.time + NIEZGODA_AFTER_S,
      run(r, b) {
        const left = copiesOf(r).find((m) => ids.includes(m.id));
        if (left) b.emit('footnote', { text: t(`heroes.copy.argue.${1 + (left.id % ARGUE_LINES)}`) });
      },
    });
  });
  bus.on('skill:cast', (ev) => {
    const run = trackedRun();
    if (!run || run.player.heroId !== 'petlowiec' || ev.free || !taken(run, 'passive9')) return;
    const st = petlState(run);
    st.streak = st.streak.skill === ev.skill ? { skill: ev.skill, n: st.streak.n + 1 } : { skill: ev.skill, n: 1 };
    if (st.streak.n < DZIENNIK_EVERY) return;
    st.streak = { skill: -1, n: 0 };
    run.hero.cd[ev.skill] = 0; // the third identical cast in a row is free: its cooldown never starts
    bus.emit('footnote', { text: t('heroes.petlowiec.logNote') });
  });
}

// ---------- the per-step work ----------

function note(s: RunState, st: PetlState): void {
  if (s.time - st.lastSnap < SNAP_STEP_S) return;
  st.lastSnap = s.time;
  const at = new Map<number, readonly [number, number]>();
  for (const e of s.enemies) at.set(e.id, [e.x, e.y]);
  st.snaps.push({ t: s.time, page: s.pageIndex, x: s.player.x, y: s.player.y, hp: s.player.hp, at });
  while (st.snaps.length > 0 && s.time - (st.snaps[0]?.t ?? s.time) > SNAP_KEEP_S) st.snaps.shift();
}

/** Opóźnienie on the HUD: the racja the logged blows will still cost him (0 while it logs with nothing owed yet); null when it neither logs nor owes. */
export function owedRacja(s: RunState): number | null {
  const st = petlStateIfAny(s);
  if (!st) return null;
  let owed = 0;
  for (const o of st.owed) if (!o.toEnemy) owed += Math.max(1, Math.round(o.amount));
  const logging = st.delay !== null && s.time < st.delay.until;
  return logging || owed > 0 ? owed : null;
}

/** Opóźnienie: pay what is owed when it falls due; never fatal. Nobody to receive it, nothing is paid. */
function payOwed(s: RunState, bus: Bus, st: PetlState): void {
  if (st.owed.length === 0) return;
  const due = st.owed.filter((o) => o.at <= s.time);
  if (due.length === 0) return;
  st.owed = st.owed.filter((o) => o.at > s.time);
  const p = s.player;
  st.dealing = true;
  try {
    for (const o of due) {
      const amount = Math.max(1, Math.round(o.amount));
      if (o.toEnemy) {
        const e = nearestEnemy(s, p.x, p.y, 400);
        if (e) applyDamage(s, bus, e, amount, false, o.type, false);
        continue;
      }
      p.hp = Math.max(Math.min(1, p.hp), p.hp - amount);
      bus.emit('player:hit', { x: p.x, y: p.y, amount, crit: false });
    }
  } finally {
    st.dealing = false;
  }
}

/** Powtórzenie § 3: whoever stands on a line left standing takes its share each TICK_S. */
function stepWritten(s: RunState, bus: Bus, st: PetlState, dt: number): void {
  if (st.written.size === 0) return;
  for (const id of [...st.written.keys()]) if (!s.zones.some((z) => z.id === id)) st.written.delete(id);
  st.acc += dt;
  if (st.acc < TICK_S) return;
  st.acc -= TICK_S;
  for (const w of st.written.values()) {
    for (const { e } of line({ s, bus }, { x: w.x, y: w.y, dx: w.dx, dy: w.dy, reach: w.reach, half: w.half })) skillDamage(s, bus, e, w.type, w.tick);
  }
}

/** Paradoks: the markers its paragraph lays inside; a clock whose zone is gone is forgotten. */
function stepClocks(s: RunState, st: PetlState): void {
  if (st.clocks.size === 0) return;
  for (const [id, clock] of [...st.clocks]) {
    const z = s.zones.find((x) => x.id === id);
    if (!z) {
      st.clocks.delete(id);
      continue;
    }
    if (!clock.status) continue;
    for (const e of enemiesWithin(s, z.x, z.y, z.r)) touchStatus(e, clock.status.kind, clock.status.seconds, s.player.id);
  }
}

/** Passive 8: a copy's shot is raised at its first step by the share when its type is not that of his last hit. */
function stepContradiction(s: RunState, st: PetlState): void {
  if (!taken(s, 'passive8') || s.projectiles.length === 0) return;
  const copies = copiesOf(s);
  if (copies.length === 0) return;
  for (const pr of s.projectiles) {
    if (pr.owner !== 'player' || pr.roll || st.seen.has(pr)) continue;
    st.seen.add(pr);
    if (!copies.some((m) => Math.hypot(pr.x - m.x, pr.y - m.y) <= m.r + 16)) continue;
    pr.damage *= copyBonus(s, pr.damageType);
  }
}

export function tickPetl(s: RunState, bus: Bus): void {
  bindPetl(bus, s);
  const st = petlState(s);
  const dt = Math.min(0.25, Math.max(0, s.time - st.last));
  st.last = s.time;
  note(s, st);
  if (st.timers.length > 0) {
    const due = st.timers.filter((x) => x.at <= s.time);
    if (due.length > 0) {
      st.timers = st.timers.filter((x) => x.at > s.time);
      for (const x of due) x.run(s, bus);
    }
  }
  stepClocks(s, st);
  stepWritten(s, bus, st, dt);
  payOwed(s, bus, st);
  stepContradiction(s, st);
}

export const quirk: HeroQuirk = {
  tick(s, bus) {
    tickPetl(s, bus);
  },
  racjaBracket: owedRacja,
};
