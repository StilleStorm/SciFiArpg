export type DeathOutcome = 'zgloszenie' | 'petla' | 'zawieszenie';

/** Stub. Death agent: pick an outcome from the run rng and apply it to RunState. */
export const DEATH_OUTCOMES: readonly DeathOutcome[] = ['zgloszenie', 'petla', 'zawieszenie'];
