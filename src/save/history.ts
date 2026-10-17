import { HISTORY_MAX, type MetaState, type RunOutcome, type TicketEntry } from './save';

/** A run that was lost. Its entry is rewritten the next time the base screen is shown (DESIGN 9.3). */
export function isLost(outcome: RunOutcome): boolean {
  return outcome !== 'ukonczono';
}

export interface RunRecord {
  number: number;
  planet: string;
  clause: TicketEntry['clause'];
  outcome: RunOutcome;
  kills: number;
  pages: number;
  total: number;
  /** Gwiazdki the player carried back. */
  gwiazdki: number;
}

/** Close a ticket: append it to the history, count it, bank the gwiazdki. Pure. */
export function recordRun(meta: MetaState, run: RunRecord): MetaState {
  const entry: TicketEntry = {
    number: run.number,
    planet: run.planet,
    clause: run.clause,
    outcome: run.outcome,
    kills: run.kills,
    pages: run.pages,
    total: run.total,
  };
  return {
    ...meta,
    runsCompleted: meta.runsCompleted + 1,
    gwiazdki: meta.gwiazdki + Math.max(0, run.gwiazdki),
    history: [...meta.history, entry].slice(-HISTORY_MAX),
  };
}

/** Entries that are lost and have not been shown corrected yet. */
export function pendingRewrites(meta: MetaState): number[] {
  const out: number[] = [];
  meta.history.forEach((e, i) => {
    if (isLost(e.outcome) && !e.rewritten) out.push(i);
  });
  return out;
}

/**
 * Mark the given entries as rewritten (the base screen has shown the struck lines and the typed-over
 * outcome). The original outcome stays in the data, so the struck lines can still be printed. Pure.
 */
export function markRewritten(meta: MetaState, indices: readonly number[]): MetaState {
  return { ...meta, history: meta.history.map((e, i) => (indices.includes(i) ? { ...e, rewritten: true } : e)) };
}

/** Which of the system's "corrected" outcomes an entry gets: stable, derived from its ticket number. */
export function rewriteIndex(entry: TicketEntry, variants: number): number {
  return variants <= 0 ? 0 : entry.number % variants;
}
