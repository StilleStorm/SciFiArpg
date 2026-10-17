import { t } from '../i18n';

/**
 * Office hours (DESIGN section 9.2): a repeating cycle in which the Sklep is served by a consultant
 * (open) or by a bot (closed). Used by the base Sklep (its own clock) and by the in-run kiosk
 * (run time, or a decision made by a regulamin clause through `setOfficeOpen`).
 */
export interface Schedule {
  /** Seconds in one cycle. */
  cycle: number;
  /** The consultant is there from this second of the cycle... */
  openFrom: number;
  /** ...for this long. */
  openFor: number;
}

/** Inside a run, when no clause decides: opens a little after the page begins, stays two minutes. */
export const KIOSK_SCHEDULE: Schedule = { cycle: 100000, openFrom: 8, openFor: 120 };
/** At the base: served for 75 s, then a 15 s break handled by the bot. */
export const BASE_SCHEDULE: Schedule = { cycle: 90, openFrom: 0, openFor: 75 };

export type HoursMode = 'open' | 'bot';

export interface HoursView {
  mode: HoursMode;
  /** Seconds until the mode changes. */
  remaining: number;
}

export function hoursAt(s: Schedule, time: number): HoursView {
  const c = ((time % s.cycle) + s.cycle) % s.cycle;
  const end = s.openFrom + s.openFor;
  if (c >= s.openFrom && c < end) return { mode: 'open', remaining: end - c };
  if (c < s.openFrom) return { mode: 'bot', remaining: s.openFrom - c };
  return { mode: 'bot', remaining: s.cycle - c + s.openFrom };
}

export interface HoursChange {
  mode: HoursMode;
  /** Seconds the new mode lasts. */
  lasts: number;
}

export interface HoursMachine {
  /** Advance to clock time `time` (seconds). Returns the change if the mode flipped since the last call. */
  tick(time: number): HoursChange | null;
  view(time: number): HoursView;
  mode(): HoursMode;
  setSchedule(s: Schedule): void;
  /** Force a mode until the next `release()` (a clause decides). */
  force(open: boolean): void;
  release(): void;
}

export function createHours(initial: Schedule): HoursMachine {
  let schedule = initial;
  let forced: HoursMode | null = null;
  let current: HoursMode | null = null;
  const modeAt = (time: number): HoursMode => forced ?? hoursAt(schedule, time).mode;
  return {
    tick(time) {
      const next = modeAt(time);
      if (next === current) return null;
      const first = current === null;
      current = next;
      if (first) return null;
      return { mode: next, lasts: forced ? Infinity : hoursAt(schedule, time).remaining };
    },
    view(time) {
      const v = hoursAt(schedule, time);
      return forced ? { mode: forced, remaining: Infinity } : v;
    },
    mode: () => current ?? 'bot',
    setSchedule(s) {
      schedule = s;
    },
    force(open) {
      forced = open ? 'open' : 'bot';
    },
    release() {
      forced = null;
    },
  };
}

// ---------- the clause override (world/laws.ts: lawHooks.officeChanged = setOfficeOpen) ----------

let override: boolean | null = null;

/** A regulamin clause decides whether the kiosk is open. Pass null to hand the decision back. */
export function setOfficeOpen(open: boolean | null): void {
  override = open;
}

export const officeOverride = (): boolean | null => override;

// ---------- bot ----------

export const BOT_LINE_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/** The n-th scripted bot reply (wraps around). */
export function botLine(n: number): string {
  const id = BOT_LINE_IDS[((n % BOT_LINE_IDS.length) + BOT_LINE_IDS.length) % BOT_LINE_IDS.length] ?? 'a';
  return t(`economy.bot.${id}`);
}

/** "1:05" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
