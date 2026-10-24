/**
 * The Anomalia's bookkeeping (STORY 3, 8.4): which stage the finale is in and which enemy is the Anomalia just now.
 * Plain data in WeakMaps keyed by the run and by the enemy object, so no field is added to `RunState` or `Enemy`.
 * No imports from the systems: `hooks.ts`, `loot.ts` and the renderer read this file freely.
 */
import type { Enemy } from '../../entities/types';
import type { HeroId } from '../../heroes';
import type { EnemyScale } from '../../world/campaign';
import type { Assembly } from '../assemble';
import type { AnomaliaFace, faceKeys } from './index';

/**
 * Phase 2 ends when the Anomalia is down to this fraction of its racja, whatever the face says. One number for the core
 * (`core.ts`, re-exported by `bodies.ts`) and the faces (`faces/common.ts`); kept here because both may import this file.
 */
export const FACE_END_FRACTION = 0.4;

/** form: one of the three family boss bodies (phase 1); face: the hero's own matter (phase 2); last: the existence finish (phase 3). */
export type AnomaliaStage = 'form' | 'face' | 'last' | 'done';

/** A footnote waiting for its time (run seconds); `correction` = printed as the Asystent's later correction of a wrong note. */
export interface QueuedNote {
  at: number;
  text: string;
  correction?: boolean;
}

export interface Finale {
  stage: AnomaliaStage;
  /** Phase 1: which form is up, 0..2 (`FORM_ORDER`). */
  form: number;
  heroId: HeroId;
  /** Correct Spor replies so far, over all three phases. */
  correct: number;
  /** The scale of the last planet (priority and `CAMPAIGN_LAST`), applied to every body the Anomalia wears. */
  scale: EnemyScale;
  /** The desk's place: where every body appears. */
  desk: { x: number; y: number };
  /** The enemy that is the Anomalia now. */
  currentId: number;
  /** The x2 window of the last reply seen, to catch the moment a right reply opens it. */
  lastWindow: number;
  queue: QueuedNote[];
  /** Ids of the bodies that were struck and left (no loot, no victory). */
  retired: Set<number>;
  /** Phase 3: the existence the Anomalia began with (falls with every right reply) and its racja then. */
  exist0: number;
  /** Seconds in the stage (run time at its start). */
  since: number;
}

interface Mark {
  run: object;
  stage: Exclude<AnomaliaStage, 'done'>;
  /** The face's hero (stage face). */
  hero?: HeroId;
}

/**
 * The faces, reached through a lookup that `register.ts` fills at boot. Low-level modules (the combat hooks, the renderer, the core)
 * must not import the registry directly: it pulls in the face modules and, through them, the hero registry, which is still being
 * evaluated when the combat code is first loaded. Without the lookup (a test that never imports `register.ts`) there is no face and
 * phase 2 is skipped.
 */
export interface FaceLookup {
  faceFor(heroId: HeroId): AnomaliaFace | undefined;
  faceKeys: typeof faceKeys;
  /** The drawing of a figure id (enemies/anomalia/faces/assembly.ts). */
  assemblyOf(figure: string, seed: number): Assembly;
}
let lookup: FaceLookup | null = null;
export const setFaceLookup = (l: FaceLookup): void => {
  lookup = l;
};
export const faceLookup = (): FaceLookup | null => lookup;
export const faceOf = (heroId: HeroId): AnomaliaFace | undefined => lookup?.faceFor(heroId);
/** The drawing of the face `heroId` wears (phase 2), or null when there is none. */
export function faceDrawing(heroId: HeroId, seed: number): Assembly | null {
  const f = faceOf(heroId);
  return f && lookup ? lookup.assemblyOf(f.figure, seed) : null;
}

const FINALES = new WeakMap<object, Finale>();
const MARKS = new WeakMap<Enemy, Mark>();

export const finaleOf = (run: object): Finale | undefined => FINALES.get(run);
export const setFinale = (run: object, f: Finale): void => {
  FINALES.set(run, f);
};

/** Mark `e` as the Anomalia in `stage` of `run`. */
export function markAnomalia(run: object, e: Enemy, stage: Mark['stage'], hero?: HeroId): void {
  MARKS.set(e, hero ? { run, stage, hero } : { run, stage });
}

export const isAnomalia = (e: Enemy): boolean => MARKS.has(e);
export const stageOf = (e: Enemy): Mark['stage'] | null => MARKS.get(e)?.stage ?? null;
export const runOf = (e: Enemy): object | null => MARKS.get(e)?.run ?? null;

/** The hero whose face this enemy wears (phase 2), for the renderer: its figure and its name. */
export const faceHeroOf = (e: Enemy): HeroId | null => {
  const m = MARKS.get(e);
  return m && m.stage === 'face' && m.hero ? m.hero : null;
};

/** The real parts of the face `e` wears (`AnomaliaFace.parts`), or null when the face has none (or `e` wears no face). */
export function facePartsOf(e: Enemy): readonly boolean[] | null {
  const hero = faceHeroOf(e);
  const f = hero ? faceOf(hero) : undefined;
  return f?.parts ? f.parts(e) : null;
}

/** True for a body of the Anomalia that was struck and left (phase 1 forms, the face): its death drops nothing and ends nothing. */
export const isRetired = (run: object, id: number): boolean => FINALES.get(run)?.retired.has(id) ?? false;

/** True for the Anomalia's own bodies (the hero's face and the existence finish): no family boss mechanic is drawn on them (ring, grid, progress). */
export const wearsOwnBody = (e: Enemy): boolean => {
  const st = MARKS.get(e)?.stage;
  return st === 'face' || st === 'last';
};

/** The i18n key under the Anomalia's drawing, or null for an ordinary boss (the renderer falls back to the family boss's name). */
export function captionKeyOf(e: Enemy): string | null {
  const m = MARKS.get(e);
  if (!m) return null;
  if (m.stage === 'face' && m.hero) return `story.finale.face.${m.hero}.name`;
  if (m.stage === 'last') return 'story.finale.phase3.name';
  return null;
}
