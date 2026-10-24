/** Test-hook functions for the finale (window.__game.finale): tests, shots and the tester jump straight into it for a hero. */
import type { Bus } from '../../core/events';
import type { HeroId } from '../../heroes';
import { CAMPAIGN_LAST, type PriorityId } from '../../world/campaign';
import type { LawId } from '../../world/laws';
import { finaleCampaign, finalePlan } from '../../world/finale';
import type { RunOptions, RunState } from '../../world/run';
import { finaleInfo, skipTo } from './core';

export interface FinaleHook {
  /**
   * Start the final ticket as a run for `heroId` (default: the hero already playing): planet 1's one-page base, struck, the Anomalia
   * at the desk in its first form; the character's campaign is set to "final ticket issued" so the closing stamp closes the case.
   * `lawId` replaces the clause the plan rolled (shots and tests that must not meet a cookie banner use 'parzystosc'). One step runs,
   * so the Anomalia is on the page. Returns the state.
   */
  start(heroId?: HeroId, opts?: { seed?: number; priority?: PriorityId; lawId?: LawId }): RunState | null;
  /** Plain data: the stage, the form, correct replies, the Anomalia's id, racja, existence, bodies struck. Null outside the finale. */
  info(): ReturnType<typeof finaleInfo>;
  /** End the stages before `target` at once ('face', 'last') or the whole finale ('end': the stamp falls). True when reached. */
  skipTo(target: 'face' | 'last' | 'end'): boolean;
}

export interface FinaleHookDeps {
  getState(): RunState | null;
  bus: Bus;
  /** `window.__game.start`: begin a run with these options (the router shows the run screen). */
  start(seed: number, opts: RunOptions): void;
  /** One step of the simulation. */
  step(): void;
}

export function createFinaleHook(d: FinaleHookDeps): FinaleHook {
  return {
    start(heroId, opts = {}) {
      const seed = opts.seed ?? 1;
      const plan = finalePlan(seed, opts.priority ?? 'normalny');
      d.start(seed, { plan: opts.lawId ? { ...plan, lawId: opts.lawId } : plan, ...(heroId ? { heroId } : {}), phase: 'run' });
      const s = d.getState();
      if (!s) return null;
      s.campaign = finaleCampaign(CAMPAIGN_LAST);
      d.step();
      return s;
    },
    info() {
      const s = d.getState();
      return s ? finaleInfo(s) : null;
    },
    skipTo(target) {
      const s = d.getState();
      return s ? skipTo(s, d.bus, target) : false;
    },
  };
}
