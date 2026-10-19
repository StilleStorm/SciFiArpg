/**
 * The ultimate runtime (S3, DESIGN 10.2): `castUltimate` spends a full Argument meter, pays the paragraph's cost, runs the hero's
 * ultimate (heroes/<id>/ultimates.ts), stamps it once, writes the page reaction in the margin and announces `ultimate:cast`.
 * `stepUltimates` ticks what is running; heroes/system.ts calls it. Cooldowns do not exist here: the meter is the price.
 * Which ultimate a hero casts is its first one until the loadout (S4) says otherwise (`HeroRun.ult.slot` is not kept yet).
 */
import { isSilenced, isStunned } from '../combat/status';
import { meterSpend, tickMeter, ultimateReady } from '../combat/meter';
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { heroById } from './registry';
import type { ParagraphNo } from './paragraphs';
import type { ActiveUlt, UltRun } from './state';
import { MAX_ULT_S, type UltEnv, type UltimateDef } from './ultimateDefs';

export { meterOf, ultimateReady } from '../combat/meter';

/** The ultimate state of a run, made on first use. */
export function ultRun(s: RunState): UltRun {
  if (!s.hero.ult) s.hero.ult = { para: 1, active: [], idle: 0 };
  return s.hero.ult;
}

/** The ultimate the hero casts now (the first one; S4's loadout will choose), or undefined for a hero without one. */
export const ultimateOf = (s: RunState): UltimateDef | undefined => heroById(s.player.heroId).ultimates?.[0];

/** The hero has an ultimate and has reached the level it opens at (FIRST_ULTIMATE_LEVEL for the first): the pad shows, the cast may go. */
export function ultimateUnlocked(s: RunState): boolean {
  const def = ultimateOf(s);
  return def !== undefined && s.player.level >= def.level;
}

/** Choose the paragraph (1..3) of the ultimate for the next cast. */
export function setUltimateParagraph(s: RunState, n: ParagraphNo): void {
  ultRun(s).para = n;
}

/** Seconds an ultimate lasts in a paragraph: the base times the patch, never more than MAX_ULT_S. */
export function ultimateSeconds(def: UltimateDef, n: ParagraphNo): number {
  return Math.min(MAX_ULT_S, def.seconds * (def.list[n - 1]?.patch.dur ?? 1));
}

function envOf(s: RunState, bus: Bus, def: UltimateDef, u: ActiveUlt): UltEnv {
  const para = def.list[u.para - 1] ?? def.list[0];
  return {
    c: { s, bus },
    s,
    bus,
    p: s.player,
    def,
    u,
    patch: para.patch,
    type: para.patch.type ?? def.type,
    tune: (key, base) => para.tune[key] ?? base,
  };
}

/** True while any ultimate of the hero is running. */
export const ultimateActive = (s: RunState): boolean => (s.hero.ult?.active.length ?? 0) > 0;

/**
 * Cast the ultimate if the meter is full and nothing forbids it (the level opens it, the run is going, no sheet is open, the hero is not zablokowany
 * or wyciszony, none is running already). The meter is spent, the paragraph's cost is paid in racja (never fatal). True when cast.
 */
export function castUltimate(s: RunState, bus: Bus): boolean {
  if (s.status !== 'running' || s.phase !== 'run' || s.modal) return false;
  const p = s.player;
  if (!ultimateReady(p) || s.law.botTime || isStunned(p) || isSilenced(p) || ultimateActive(s)) return false;
  const def = ultimateOf(s);
  if (!def || p.level < def.level) return false;
  const run = ultRun(s);
  const seconds = ultimateSeconds(def, run.para);
  const para = def.list[run.para - 1] ?? def.list[0];
  const patch = para.patch;
  const u: ActiveUlt = {
    id: def.id,
    para: run.para,
    left: seconds,
    dur: seconds,
    dmg: s.hero.mods.dmg * (patch.dmg ?? 1),
    x: p.x,
    y: p.y,
    acc: 0,
    ids: [],
    seen: s.kills,
  };
  const r = def.radius === null ? undefined : para.tune['radius'] ?? def.radius;
  if (r !== undefined) u.r = r;
  meterSpend(p);
  if (patch.cost) p.hp = Math.max(Math.min(1, p.hp), p.hp - patch.cost);
  run.active.push(u);
  const env = envOf(s, bus, def, u);
  def.cast(env);
  bus.emit('stamp', { text: t(def.stampKey), x: p.x, y: p.y - 34, quiet: true }); // quiet: the ultimate recipe ends in its own thud
  bus.emit('margin:note', { text: t(def.noteKey, { number: 1000 + (s.seed % 9000) }), x: p.x, y: p.y - p.r - 56 });
  bus.emit('ultimate:cast', { heroId: p.heroId, ultimateId: def.id, x: p.x, y: p.y });
  return true;
}

/** Per step: the meter drains out of combat, and what runs is ticked; at the end of its time it is ended and removed. */
export function stepUltimates(s: RunState, bus: Bus, dt: number): void {
  if (!s.hero.ult && s.player.meter <= 0) return; // nothing to drain, nothing running: the record is made when first needed
  const run = ultRun(s);
  tickMeter(s, run, dt);
  const def = ultimateOf(s);
  for (let i = run.active.length - 1; i >= 0; i--) {
    const u = run.active[i];
    if (!u) continue;
    if (!def || def.id !== u.id) {
      run.active.splice(i, 1);
      continue;
    }
    const env = envOf(s, bus, def, u);
    u.left -= dt;
    def.tick?.(env, dt);
    if (u.left <= 1e-9) {
      run.active.splice(i, 1);
      def.end?.(env);
    }
  }
}

/** What the running ultimate does to the auto-attack: the number of shots and whether every line pierces. Null when none runs. */
export function ultimateAuto(s: RunState): { shots: number; pierce: boolean } | null {
  const u = s.hero.ult?.active.find((x) => x.shots !== undefined || x.pierce === true);
  return u ? { shots: u.shots ?? 1, pierce: u.pierce === true } : null;
}
