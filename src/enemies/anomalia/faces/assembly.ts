/** The Assembly (enemies/assemble.ts) of a face's figure, for the renderer and the shot script. Pure. */
import { ENEMY_SCALE, serialOf, type Assembly } from '../../assemble';
import { bodyById } from '../../parts';
import type { HeroId } from '../../../heroes';
import { faceFor } from '../index';
import { FACE_FIGURES } from './figures';

export const FIGURE_SCALE = 1.3;

export function faceAssemblyOf(figureId: string, seed = 1): Assembly {
  const body = bodyById(figureId) ?? FACE_FIGURES[0];
  if (!body) throw new Error('no face figure');
  return {
    family: 'wygenerowane',
    tier: 1,
    body: body.id,
    variant: 0,
    legs: null,
    head: null,
    decos: [],
    legLen: body.ownLegLen ?? 0,
    scale: FIGURE_SCALE,
    dotted: body.dotted ?? 0,
    serial: serialOf(seed),
    height: body.h + (body.ownLegLen ?? 0),
    radius: Math.round(Math.max(30, body.w * 0.36) * ENEMY_SCALE),
    width: body.w,
  };
}

/** Assembly of the face worn for `heroId` (the registry's `figure`). */
export function faceAssembly(heroId: HeroId, seed = 1): Assembly | null {
  const f = faceFor(heroId);
  return f ? faceAssemblyOf(f.figure, seed) : null;
}
