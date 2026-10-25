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
import { paragraphsFree } from '../world/contentKinds';

export { meterOf, ultimateReady } from '../combat/meter';

/** The ultimate state of a run, made on first use. */
export function ultRun(s: RunState): UltRun {
  if (!s.hero.ult) s.hero.ult = { para: 1, active: [], idle: 0 };
  return s.hero.ult;
}

/** The ultimate the hero casts now (the first one; S4's loadout will choose), or undefined for a hero without one. */
export const ultimateOf = (s: RunState): UltimateDef | undefined => {
  const all = heroById(s.player.heroId).ultimates;
  return all?.find((u) => u.id === s.hero.ultimateId) ?? all?.[0];
};

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
  if (patch.cost && !paragraphsFree(s.buffs)) p.hp = Math.max(Math.min(1, p.hp), p.hp - patch.cost); // zwolnienie waives the price
  run.active.push(u);
  const env = envOf(s, bus, def, u);
  def.cast(env);
  const text = t(def.stampKey);
  const spot = ultStampSpot(s.enemies, p.x, p.y, text.length);
  // never on the hero: beside him on the emptier side; render/bindings keeps it inside the view and off `away`
  bus.emit('stamp', { text, x: spot.x, y: spot.y, quiet: true, away: { x: p.x, y: p.y } }); // quiet: the ultimate recipe ends in its own thud
  bus.emit('margin:note', { text: t(def.noteKey, { number: 1000 + (s.seed % 9000) }), x: p.x, y: ultNoteY(s.enemies, p.x, p.y, p.r) });
  bus.emit('ultimate:cast', { heroId: p.heroId, ultimateId: def.id, x: p.x, y: p.y });
  return true;
}

/**
 * How far above or below the hero the ultimate's stamp may land (units): clear of his figure. Above is preferred (below are
 * the thumbs and the pads): a spot below counts as half an enemy more crowded.
 */
export const ULT_STAMP_OFFSETS: readonly number[] = [-130, -190, -260, -330, 130, 190];

/**
 * Where the ultimate's stamp lands: above or below the hero (never on him), where the fewest enemies stand under the stamp's
 * box (about 20 units a letter at 17 px Michroma, render/ink.ts stamp); a tie goes to the nearer spot above. Pure.
 */
export function ultStampSpot(enemies: readonly { x: number; y: number }[], x: number, y: number, letters: number): { x: number; y: number } {
  const hw = (letters * 20 + 30) / 2 + 24;
  const hh = 20 + 40;
  let best = { x, y: y + (ULT_STAMP_OFFSETS[0] ?? -130) };
  let bestN = Infinity;
  for (const dy of ULT_STAMP_OFFSETS) {
    const cy = y + dy;
    let n = dy > 0 ? 0.5 : 0;
    for (const e of enemies) if (Math.abs(e.x - x) < hw && Math.abs(e.y - cy) < hh) n++;
    if (n < bestN) {
      bestN = n;
      best = { x, y: cy };
    }
  }
  return best;
}

/** How far the margin note stands from the hero's centre beyond his radius (units). */
export const ULT_NOTE_GAP = 56;

/**
 * Where the ultimate's margin note goes: above the hero, or below him when more enemies stand above. The ultimate's own strokes
 * (a pull line, a lash, a queue) run from the hero to them, so the note on the emptier side is not overprinted (S19 look:
 * Koniec kolejki's pull line through the note). Counts enemies within 260 units across and 320 up or down; a tie stays above. Pure.
 */
export function ultNoteY(enemies: readonly { x: number; y: number }[], x: number, y: number, r: number): number {
  let above = 0;
  let below = 0;
  for (const e of enemies) {
    if (Math.abs(e.x - x) > 260 || Math.abs(e.y - y) > 320) continue;
    if (e.y < y) above++;
    else if (e.y > y) below++;
  }
  return above > below ? y + r + ULT_NOTE_GAP : y - r - ULT_NOTE_GAP;
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
