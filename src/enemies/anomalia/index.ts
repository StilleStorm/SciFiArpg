/**
 * The Anomalia (STORY 3, 8.4): the face registry, the contract between the core phases
 * (`core.ts`, `phase1.ts`, `phase3.ts`, owned by anomalia-core) and the five hero faces
 * (`faces/*.ts`, owned by anomalia-faces). Phase 2 is the face of the applicant's own hero.
 * The core calls `start` when phase 1 ends, `tick` every step while phase 2 runs, `damageMul`
 * on every hit on the Anomalia in phase 2, and `stop` when `done` reports true (or the run ends),
 * then moves to phase 3. Face state lives in the face module keyed by the enemy object
 * (a WeakMap), not on RunState. Text: `story.finale.face.<heroId>.*`; the core posts the Spór
 * from `sporKeys` once, like a boss phase prompt, and prints `meet` on start and `end` on stop.
 */
import type { DamageType } from '../../combat/damage';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import type { HeroId } from '../../heroes';
import type { RunState } from '../../world/run';
import { ALL_FACES } from './faces';

export interface AnomaliaFace {
  heroId: HeroId;
  /** The correct Spór reply type of this face (STORY 8.4). */
  sporAnswer: DamageType;
  /** Enter phase 2: set the figure, reset face state. */
  start(s: RunState, e: Enemy, bus: Bus): void;
  /** One fixed step of the face mechanic (hold/transfer, strip, rewind, real terrain, edge-on). */
  tick(s: RunState, e: Enemy, bus: Bus, dt: number): void;
  /** Multiplier on a hit on the Anomalia at world point (x, y) during phase 2: 0 = it cannot be hurt there. */
  damageMul(s: RunState, e: Enemy, x: number, y: number): number;
  /** Phase 2 is over (the core also ends it at its racja threshold). */
  done(s: RunState, e: Enemy): boolean;
  /** Leave phase 2: undo anything the face changed on the hero or the page. */
  stop(s: RunState, e: Enemy, bus: Bus): void;
  /** Part-library id of the face's figure (enemies/parts*), drawn while phase 2 runs. */
  figure: string;
  /**
   * Optional: which parts of the body are real now, part 0 the centre and 1..n equal sectors by angle from the left (atan2 + pi),
   * for the renderer (render/enemyFigures.ts draws a solid arc where real, a dotted one elsewhere). Planeta Nieistniejaca.
   */
  parts?(e: Enemy): readonly boolean[];
}

const FACES = new Map<HeroId, AnomaliaFace>();

export function registerFace(f: AnomaliaFace): void {
  FACES.set(f.heroId, f);
}

export const faceFor = (heroId: HeroId): AnomaliaFace | undefined => FACES.get(heroId);

/** Text keys of a face; replies are keyed by damage type, the core shuffles them. */
export const faceKeys = (heroId: HeroId) => ({
  name: `story.finale.face.${heroId}.name`,
  meet: `story.finale.face.${heroId}.meet`,
  line: `story.finale.face.${heroId}.line`,
  comment: `story.finale.face.${heroId}.spor.comment`,
  reply: (type: DamageType) => `story.finale.face.${heroId}.spor.reply.${type}`,
  end: `story.finale.face.${heroId}.end`,
});

for (const f of ALL_FACES) registerFace(f);
