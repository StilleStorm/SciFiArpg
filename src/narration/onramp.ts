/**
 * The on-ramp (S16): five plain footnotes on the very first ticket of a new file, each said once and never wrong
 * (the Asystent's 1-in-8 mistakes would teach the wrong thing here): walk, attack, rebut, update, the first potwierdzenie.
 * Text: `narration.onramp.*`. A file with a Historia entry is no longer new: nothing is said.
 */
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from '../world/run';

export type OnrampStep = 'walk' | 'attack' | 'rebut' | 'update' | 'potw';
export const ONRAMP_STEPS: readonly OnrampStep[] = ['walk', 'attack', 'rebut', 'update', 'potw'];
/** Seconds of a first run without a step of the player before the walk note is written. */
export const WALK_AFTER_S = 4;
/** Distance (world units) the player must have moved from the spawn for the walk note to be spared. */
export const WALK_DIST = 60;

export interface OnrampDeps {
  say(text: string): number;
  getState(): RunState | null;
  /** True while the file has no Historia entry. */
  firstTicket(): boolean;
}

export interface Onramp {
  tick(dt: number): void;
  /** Steps already said on this page load. */
  readonly said: readonly OnrampStep[];
}

export function bindOnramp(bus: Bus, deps: OnrampDeps): Onramp {
  const said = new Set<OnrampStep>();
  let runTime = 0;
  let origin: { x: number; y: number } | null = null;

  const speak = (step: OnrampStep): void => {
    if (said.has(step) || !deps.firstTicket()) return;
    said.add(step);
    deps.say(t(`narration.onramp.${step}`));
  };

  bus.on('run:started', () => {
    runTime = 0;
    origin = null;
  });
  bus.on('attack:started', (e) => {
    if (e.attacker === 'player') speak('attack');
  });
  bus.on('enemy:rebutted', () => speak('rebut'));
  bus.on('update:ready', () => speak('update'));
  bus.on('recovery:taken', () => speak('potw'));

  return {
    tick(dt) {
      if (said.has('walk') || !deps.firstTicket()) return;
      const s = deps.getState();
      if (!s || s.phase !== 'run') return;
      origin ??= { x: s.player.x, y: s.player.y };
      runTime += dt;
      if (Math.hypot(s.player.x - origin.x, s.player.y - origin.y) >= WALK_DIST) {
        said.add('walk'); // the player found it unprompted
        return;
      }
      if (runTime >= WALK_AFTER_S) speak('walk');
    },
    get said() {
      return [...said];
    },
  };
}
