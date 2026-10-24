/**
 * The drawings of the location props, keyed by location type and prop id (world/planets/locations.ts has the same ids and the
 * footprints). A prop without a drawing, or an obstacle of a type nobody registered, falls back to the generic ink blot, so a
 * planet's types can arrive data first and drawings later.
 */
import { createRng, type Rng } from '../../core/rng';
import type { LocationType } from '../../world/campaign';
import type { Obstacle } from '../../world/pages';
import { blobPoints, dotPath, el, n2, smoothClosed } from '../svg';

export type PropDrawer = (o: Obstacle, r: Rng) => SVGGElement;

const BY_TYPE = new Map<LocationType, Record<string, PropDrawer>>();

/** A location module registers the drawings of its type (called at import time by `locations/<type>.ts`). */
export function registerDrawings(type: LocationType, drawers: Record<string, PropDrawer>): void {
  BY_TYPE.set(type, drawers);
}

/** The prop ids a type has drawings for. */
export const drawingsOf = (type: LocationType): string[] => Object.keys(BY_TYPE.get(type) ?? {});

function drawerFor(id: string | undefined): PropDrawer | undefined {
  if (!id) return undefined;
  for (const table of BY_TYPE.values()) {
    const d = table[id];
    if (d) return d;
  }
  return undefined;
}

/** The generic obstacle: a plain ink blot (what a page without a location is made of). */
function fallback(o: Obstacle, r: Rng): SVGGElement {
  const g = el('g', { transform: `translate(${n2(o.x)} ${n2(o.y)})` });
  const p = el('path', { d: smoothClosed(blobPoints(r, 0, 0, o.size * 0.4, 11, 0.3)) + dotPath(o.size * 0.5, o.size * 0.2, 2) });
  p.style.fill = 'var(--ink)';
  p.style.stroke = 'none';
  g.append(p);
  return g;
}

/** Draw a prop obstacle (kind 'prop'). */
export function drawProp(o: Obstacle, r: Rng = createRng(o.seed)): SVGGElement {
  return (drawerFor(o.variant) ?? fallback)(o, r);
}
