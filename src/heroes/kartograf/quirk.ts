/**
 * What the Kartograf's skills 6 to 10 and his passives do from step to step (docs/SKILLS.md section 4), run by the hero system
 * through `HeroQuirk.tick`: the survey lines that stay, the borders and who crosses them, the benchmarks that pull the eyes, the
 * decoys that strike back (passive 9), and his rule, passive 7 Mapa z gory: the first enemy of each family on a page is named
 * wrongly in a footnote and corrected when it falls. Passive 8 (the distance) is `dealtMul`; passive 10 is `lineHit` in hits.ts.
 * Everything lives in `kartograf/state.ts`.
 */
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import { hasEffect } from '../../items/sets';
import type { RunState } from '../../world/run';
import { enemiesWithin, skillDamage, touchStatus } from '../helpers';
import type { HeroQuirk } from '../module';
import { line, push } from '../primitives';
import { taken } from './hits';
import { AWARIA_SLOW, BLAD_DAMAGE, BLAD_EVERY_S, NAME_SIGHT, ODLEGLOSC_MAX, ODLEGLOSC_STEP, ODNIESIENIA_PULL_EVERY_S, ODNIESIENIA_PULL_R, ODNIESIENIA_PULL_S } from './numbers';
import { kartState, type KartState } from './state';

/** Passive 8: the factor on a blow to `target`, 1% for every ten units of the line from him to it, at most 20%. */
export function distanceMul(s: RunState, target: Enemy): number {
  if (!taken(s, 'passive8')) return 1;
  const d = Math.hypot(target.x - s.player.x, target.y - s.player.y);
  return 1 + Math.min(ODLEGLOSC_MAX, ODLEGLOSC_STEP * Math.floor(d / 10));
}

/** A line of Przekroj that stays (§ 3): whoever stands on it waits for verification while it lasts. */
function stepLines(s: RunState, bus: Bus, k: KartState): void {
  if (k.lines.length === 0) return;
  k.lines = k.lines.filter((l) => s.time < l.until);
  for (const l of k.lines) for (const { e } of line({ s, bus }, { x: l.x, y: l.y, dx: l.dx, dy: l.dy, reach: l.reach, half: l.half })) touchStatus(e, 'do_weryfikacji', 0.5, s.player.id);
}

const sideOf = (b: { x: number; y: number; nx: number; ny: number }, e: Enemy): number => Math.sign((e.x - b.x) * b.nx + (e.y - b.y) * b.ny) || 1;

/** Granica: whoever changes sides along its length is a crosser: pushed back, struck, and given the status of the paragraph. */
function stepBorders(s: RunState, bus: Bus, k: KartState): void {
  if (k.borders.length === 0) return;
  k.borders = k.borders.filter((b) => s.time < b.until && s.zones.some((z) => z.id === b.zone));
  const p = s.player;
  for (const b of k.borders) {
    for (const e of [...s.enemies]) {
      const now = sideOf(b, e);
      const was = b.sides.get(e.id);
      b.sides.set(e.id, now);
      if (was === undefined || was === now) continue;
      if (Math.abs((e.x - b.x) * b.ux + (e.y - b.y) * b.uy) > b.half + e.r) continue; // round the end of it
      if (b.dmg > 0 && skillDamage(s, bus, e, b.type, b.dmg)) continue;
      touchStatus(e, b.status.kind, b.status.seconds, p.id);
      if (b.push > 0 && !e.boss) {
        push({ s, bus }, e, b.nx * was, b.ny * was, b.push, { mode: 'sweep' });
        b.sides.set(e.id, sideOf(b, e));
      }
    }
  }
}

/** Punkt odniesienia § 3: every few seconds whoever is near reads the benchmark (przeczytane toward it). */
function stepBenches(s: RunState, k: KartState): void {
  if (k.benches.size === 0) return;
  for (const [id, b] of k.benches) {
    const m = s.summons.find((x) => x.id === id);
    if (!m) {
      k.benches.delete(id);
      continue;
    }
    if (!b.pull || s.time < b.next) continue;
    b.next = s.time + ODNIESIENIA_PULL_EVERY_S;
    for (const e of enemiesWithin(s, m.x, m.y, ODNIESIENIA_PULL_R)) touchStatus(e, 'przeczytane', ODNIESIENIA_PULL_S, id);
  }
}

/** Passive 9, Blad pomiaru: whoever touches a decoy of his is struck for 0.5x (mechaniczny), at most once a second per decoy. */
function stepDecoys(s: RunState, bus: Bus, k: KartState): void {
  if (!taken(s, 'passive9')) return;
  const live = new Set<number>();
  for (const m of s.summons) {
    if (m.variant !== 'decoy') continue;
    live.add(m.id);
    if (s.time < (k.decoyNext.get(m.id) ?? 0)) continue;
    const touching = enemiesWithin(s, m.x, m.y, m.r + 8);
    if (touching.length === 0) continue;
    k.decoyNext.set(m.id, s.time + BLAD_EVERY_S);
    for (const e of touching) skillDamage(s, bus, e, 'mechaniczny', BLAD_DAMAGE);
  }
  for (const id of [...k.decoyNext.keys()]) if (!live.has(id)) k.decoyNext.delete(id);
}

/** The enemies that fell since the last look: ids that vanished while the kill count rose (a page turn clears the page without a kill). */
function diedSince(s: RunState, k: KartState): number[] {
  const now = new Set<number>();
  for (const e of s.enemies) now.add(e.id);
  const out: number[] = [];
  const kills = s.kills - k.kills;
  if (kills > 0) for (const id of k.alive) if (!now.has(id)) out.push(id);
  k.alive = now;
  k.kills = s.kills;
  return out.length > kills ? out.slice(0, kills) : out;
}

/** The rule, Mapa z gory: the first enemy of each family on a page, once he sees it, is named wrongly; its death corrects the note. */
function stepNames(s: RunState, bus: Bus, k: KartState): void {
  if (s.time < k.nameAt) return;
  k.nameAt = s.time + 0.2;
  const p = s.player;
  if (k.page !== s.pageIndex) {
    k.page = s.pageIndex;
    k.named.clear();
    k.misnamed.clear();
    k.alive = new Set(s.enemies.map((e) => e.id));
    k.kills = s.kills;
  }
  for (const id of diedSince(s, k)) {
    const family = k.misnamed.get(id);
    if (family === undefined) continue;
    k.misnamed.delete(id);
    bus.emit('footnote', { text: t(`heroes.kartograf.rule.${family}.right`), correction: true });
  }
  if (s.phase !== 'run') return;
  for (const e of s.enemies) {
    if (e.boss || k.named.has(e.family)) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > NAME_SIGHT) continue;
    k.named.add(e.family);
    k.misnamed.set(e.id, e.family);
    bus.emit('footnote', { text: t(`heroes.kartograf.rule.${e.family}.wrong`) });
  }
}

/** «Awaria», three pieces (ITEMS section 12): the rule doubles, so whoever he has named wrongly also walks 20% slower. */
export function misnamedSlow(s: RunState, e: Enemy): number {
  if (!hasEffect(s.player, 'regula-podwojona')) return 1;
  return kartState(s).misnamed.has(e.id) ? AWARIA_SLOW : 1;
}

export const quirk: HeroQuirk = {
  tick(s, bus) {
    const k = kartState(s);
    stepNames(s, bus, k);
    stepLines(s, bus, k);
    stepBorders(s, bus, k);
    stepBenches(s, k);
    stepDecoys(s, bus, k);
  },
  dealtMul: distanceMul,
  enemySpeedMul: misnamedSlow,
};

