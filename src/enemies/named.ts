/**
 * Named elites (PLAN 8, "Diablo 2 unique monsters"): two or three affixes and an absurd name the Asystent records
 * ("Monit Zbiorczy, nieodebrany od 2019 r."). At most one per two pages; the kill guarantees an item of at least
 * nietypowy. Names are 30 parts in `enemies.named.*` (10 nouns, 10 adjectives, 10 participial tails), put together
 * with gender agreement. Pure data and lookups; spawning is in spawn.ts.
 */
import type { Rng } from '../core/rng';
import { genderForm, t, type Gender } from '../i18n';
import type { RunState } from '../world/run';
import { ELITE_IDS, type EliteId } from './ids';

export const NOUN_IDS = ['monit', 'wezwanie', 'pismo', 'zawiadomienie', 'upomnienie', 'decyzja', 'notatka', 'odpowiedz', 'okolnik', 'zalacznik'] as const;
export const ADJ_IDS = ['zbiorczy', 'ostateczny', 'wtorny', 'ponowny', 'przejsciowy', 'zastepczy', 'okresowy', 'wewnetrzny', 'uzupelniajacy', 'szczegolowy'] as const;
export const TAIL_IDS = ['nieodebrany', 'zwrocony', 'zlozony', 'doreczony', 'uznany', 'przekazany', 'oczekujacy', 'wycofany', 'zaginiony', 'podpisany'] as const;

/** At least this many pages between two named elites. */
export const NAMED_PAGE_GAP = 2;
/** Chance that an elite roll becomes a named elite when the page gap allows it. */
export const NAMED_CHANCE = 0.4;
/** The lowest item tier a named elite leaves. */
export const NAMED_MIN_TIER = 'nietypowy' as const;

const GENDERS3: readonly Gender[] = ['m', 'f', 'n'];

/** A noun, an adjective and a tail agreeing in gender: "Monit Zbiorczy, nieodebrany od 2019 r.". */
export function composeName(noun: string, adj: string, tail: string): string {
  const g = t(`enemies.named.noun.${noun}.gender`);
  const gender: Gender = GENDERS3.find((x) => x === g) ?? 'm';
  const form = (prefix: string): string => genderForm({ m: t(`${prefix}.m`), f: t(`${prefix}.f`), n: t(`${prefix}.n`), pl: t(`${prefix}.n`) }, gender);
  return `${t(`enemies.named.noun.${noun}.text`)} ${form(`enemies.named.adj.${adj}`)}, ${form(`enemies.named.tail.${tail}`)}`;
}

/** Draw a name from the seeded generator. */
export function generateName(rng: Rng): string {
  return composeName(rng.pick(NOUN_IDS), rng.pick(ADJ_IDS), rng.pick(TAIL_IDS));
}

/** Two or three different affixes. */
export function pickNamedAffixes(rng: Rng): EliteId[] {
  const pool = [...ELITE_IDS];
  const n = rng.chance(0.5) ? 2 : 3;
  const out: EliteId[] = [];
  for (let i = 0; i < n; i++) {
    const k = rng.int(0, pool.length - 1);
    const [id] = pool.splice(k, 1);
    if (id) out.push(id);
  }
  return out;
}

// ---------- the record of the run ----------

export interface NamedRecord {
  id: number;
  name: string;
  affixes: EliteId[];
  family: string;
  /** The item guarantee was handed out. */
  claimed: boolean;
}
interface RunNamed {
  /** Page index of the last named elite placed, or null before the first. */
  lastPage: number | null;
  records: Map<number, NamedRecord>;
}
const runs = new WeakMap<RunState, RunNamed>();
const runOf = (s: RunState): RunNamed => {
  let r = runs.get(s);
  if (!r) {
    r = { lastPage: null, records: new Map() };
    runs.set(s, r);
  }
  return r;
};

/** May a named elite appear on the current page? One per two pages at most. */
export function namedAllowed(s: RunState): boolean {
  const last = runOf(s).lastPage;
  return last === null || s.pageIndex - last >= NAMED_PAGE_GAP || s.pageIndex < last;
}

/** Enter a named elite in the run's record (the page counts from now on). */
export function recordNamed(s: RunState, rec: NamedRecord): void {
  const r = runOf(s);
  r.lastPage = s.pageIndex;
  r.records.set(rec.id, rec);
}

export const namedRecord = (s: RunState, id: number): NamedRecord | undefined => runOf(s).records.get(id);

/**
 * The named-elite drop guarantee. The loot system calls this from its `enemy:died` handler with the dead enemy's
 * id; the answer is the lowest tier the kill must leave (an extra item, rolled at that tier or better), once.
 * Null for every other enemy. The same fact is announced as the `elite:slain` event.
 * `bindLoot` (systems/loot.ts) calls it and drops the extra item through `dropGuaranteed`.
 */
export function claimNamedDrop(s: RunState, id: number): { minTier: typeof NAMED_MIN_TIER; name: string } | null {
  const rec = runOf(s).records.get(id);
  if (!rec || rec.claimed) return null;
  rec.claimed = true;
  return { minTier: NAMED_MIN_TIER, name: rec.name };
}
