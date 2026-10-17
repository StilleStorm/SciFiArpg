/**
 * The Asystent: the ticket system's assistant, who writes the footnotes (DESIGN 9.3).
 * Sober, exact, and about 1 in 8 confidently wrong; a later note corrects it by number.
 *
 * `createNarrator` is the pure core (rng + a `say` function that returns the footnote number).
 * `bindAsystent` connects it to the bus. Templates live in i18n/pl/narration.json as
 * `<key>.ok[]`, `<key>.bad[]`, `<key>.fix[]` (bad[i] is corrected by fix[i]).
 */
import type { Bus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import { t, type Params } from '../i18n';
import narrationJson from '../i18n/pl/narration.json';
import { enemyInfo } from '../world/enemyInfo';
import type { RunState } from '../world/run';

export const WRONG_CHANCE = 1 / 8;
export const CORRECTION_DELAY_S: readonly [number, number] = [10, 20];
export const IDLE_S = 40;
/** Notes of these kinds are dropped when another note was spoken less than LOW_GAP_S ago. */
const LOW_PRIORITY = new Set(['pickup', 'edge', 'law_noise']);
const LOW_GAP_S = 2;

type Pool = { ok?: string[]; bad?: string[]; fix?: string[] };
const POOLS = narrationJson as Record<string, Pool>;

export function hasNote(key: string): boolean {
  return (POOLS[key]?.ok?.length ?? 0) > 0;
}

export function poolSize(key: string, kind: 'ok' | 'bad' | 'fix'): number {
  return POOLS[key]?.[kind]?.length ?? 0;
}

interface Pending {
  at: number;
  key: string;
  index: number;
  ref: number;
  params: Params;
}

export interface Narrator {
  /** Speak a note for `key`; may be wrong. Returns the footnote number, or 0 if nothing was said. */
  note(key: string, params?: Params): number;
  /** Advance the narration clock (seconds). Speaks due corrections. */
  tick(dt: number): void;
  readonly time: number;
  /** Corrections that are scheduled but not spoken yet. */
  readonly pending: number;
}

/** Numbers that are plausibly off by a little: the wrong notes use them. */
function nearby(rng: Rng, n: number, min = 1): number {
  const delta = rng.int(1, 3);
  return rng.chance(0.5) || n - delta < min ? n + delta : n - delta;
}

export function createNarrator(rng: Rng, say: (text: string) => number): Narrator {
  let time = 0;
  let lastSay = -100;
  const pending: Pending[] = [];

  const speak = (text: string): number => {
    lastSay = time;
    return say(text);
  };

  return {
    note(key, params = {}) {
      const pool = POOLS[key];
      const oks = pool?.ok?.length ?? 0;
      if (!pool || oks === 0) return 0;
      if (LOW_PRIORITY.has(key) && time - lastSay < LOW_GAP_S) return 0;
      const bads = pool.bad?.length ?? 0;
      const wrong = bads > 0 && rng.chance(WRONG_CHANCE);
      const p: Params = { ...params };
      if (typeof p['n'] === 'number') p['wrong'] = nearby(rng, p['n']);
      if (typeof p['page'] === 'number') p['wrong'] = nearby(rng, p['page']);
      if (typeof p['level'] === 'number') p['wrong'] = nearby(rng, p['level'], 2);
      if (wrong) {
        const index = rng.int(0, bads - 1);
        const n = speak(t(`narration.${key}.bad.${index}`, p));
        pending.push({ at: time + rng.range(CORRECTION_DELAY_S[0], CORRECTION_DELAY_S[1]), key, index, ref: n, params: p });
        return n;
      }
      const index = rng.int(0, oks - 1);
      return speak(t(`narration.${key}.ok.${index}`, p));
    },
    tick(dt) {
      time += dt;
      for (let i = pending.length - 1; i >= 0; i--) {
        const c = pending[i];
        if (!c || time < c.at) continue;
        pending.splice(i, 1);
        speak(t(`narration.${c.key}.fix.${c.index}`, { ...c.params, ref: c.ref }));
      }
    },
    get time() {
      return time;
    },
    get pending() {
      return pending.length;
    },
  };
}

export interface AsystentDeps {
  /** Show a footnote and return its number (ui/footnotes.ts). */
  say(text: string): number;
  getState(): RunState | null;
}

export interface Asystent {
  /** Advance by simulated seconds while a run is going. */
  tick(dt: number): void;
}

/** Wire the Asystent to the bus. A fresh narrator (seeded from the run) starts on every `run:started`. */
export function bindAsystent(bus: Bus, deps: AsystentDeps): Asystent {
  let narrator = createNarrator(createRng(1), deps.say);
  let idle = 0;
  const families = new Set<string>();

  bus.on('run:started', (e) => {
    narrator = createNarrator(createRng(e.seed).fork('narration'), deps.say);
    idle = 0;
    families.clear();
    const s = deps.getState();
    narrator.note('start', { number: s?.ticket.number ?? 0 });
    if (s) {
      narrator.note('clause', { name: t(`laws.${s.ticket.lawId}.name`), short: t(`laws.${s.ticket.lawId}.short`) });
    }
  });
  bus.on('enemy:died', (e) => {
    idle = 0;
    const info = enemyInfo(e.id);
    const family = e.family ?? info?.family ?? 'other';
    if (families.has(family)) return;
    families.add(family);
    const n = 4400 + e.id;
    narrator.note(hasNote(`kill_${family}`) ? `kill_${family}` : 'kill_other', { n });
  });
  bus.on('pickup:taken', (e) => narrator.note('pickup', { n: e.number }));
  bus.on('page:edge', () => narrator.note('edge'));
  bus.on('page:entered', (e) => {
    if (e.index > 0) narrator.note('page', { page: e.index + 1, total: e.count });
  });
  bus.on('player:levelup', (e) => narrator.note('levelup', { level: e.level }));
  bus.on('player:died', () => narrator.note('death'));
  bus.on('law:trigger', (e) => narrator.note(`law_${e.kind.replace(/[:-]/g, '_')}`));

  return {
    tick(dt) {
      narrator.tick(dt);
      idle += dt;
      if (idle >= IDLE_S) {
        idle = -IDLE_S; // then at most one idle note per 80 s
        narrator.note('idle');
      }
    },
  };
}
