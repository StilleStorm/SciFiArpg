/** The Assembly (enemies/assemble.ts) of a face's figure, for the renderer and the shot script. Pure. */
import { ENEMY_SCALE, serialOf, type Assembly } from '../../assemble';
import { bodyById } from '../../parts';
import type { HeroId } from '../../../heroes';
import { faceFor } from '../index';
import { FACE_FIGURES, FIGURE_IDS } from './figures';

export const FIGURE_SCALE = 1.3;
/**
 * A figure drawn larger than the rest (times FIGURE_SCALE): the Węzeł's crowd is small figures and must read as dozens of
 * outlines at phone size; the Planeta is terrain, page-sized, its measured arcs around it.
 */
export const FIGURE_SIZE: Readonly<Record<string, number>> = { [FIGURE_IDS.wezel]: 1.45, [FIGURE_IDS.planeta]: 2 };
/** The body's radius as a fraction of its width (the planet is a disc: its sectors reach its drawn edge, `planeta.ts partAt`). */
const RADIUS_FRAC: Readonly<Record<string, number>> = { [FIGURE_IDS.planeta]: 0.56 };

export function faceAssemblyOf(figureId: string, seed = 1): Assembly {
  const body = bodyById(figureId) ?? FACE_FIGURES[0];
  if (!body) throw new Error('no face figure');
  const k = FIGURE_SIZE[body.id] ?? 1;
  return {
    family: 'wygenerowane',
    tier: 1,
    body: body.id,
    variant: 0,
    legs: null,
    head: null,
    decos: [],
    legLen: body.ownLegLen ?? 0,
    scale: FIGURE_SCALE * k,
    dotted: body.dotted ?? 0,
    serial: serialOf(seed),
    height: body.h + (body.ownLegLen ?? 0),
    radius: Math.round(Math.max(30, body.w * (RADIUS_FRAC[body.id] ?? 0.36) * k) * ENEMY_SCALE),
    width: body.w,
  };
}

/** Assembly of the face worn for `heroId` (the registry's `figure`). */
export function faceAssembly(heroId: HeroId, seed = 1): Assembly | null {
  const f = faceFor(heroId);
  return f ? faceAssemblyOf(f.figure, seed) : null;
}
