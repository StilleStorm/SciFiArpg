import { readableUnits } from './camera';

/**
 * Drawn plate lettering (S28b). Type on a plate printed in the world was 4.6-8.5 units, 3-8 css px at the landscape zoom. A plate's
 * type now takes the size that reads `minPx` css px at the zoom now (`readableUnits`), and the plate is cut to the width the word
 * needs. Space Mono's advance is 0.6 em.
 */
export const PLATE_MIN_PX = 11;
const ADVANCE = 0.6;

/** The type size in units for a plate word that reads at least PLATE_MIN_PX css px at the zoom now (`base` when that is already enough). */
export function plateSize(base: number, scale = 1): number {
  return readableUnits(base * scale, PLATE_MIN_PX) / scale;
}

/** The plate width in units that holds `chars` letters of `size` units, with `pad` units of margin on each side. Pure. */
export function plateWidth(chars: number, size: number, pad = 4, min = 0): number {
  return Math.max(min, chars * size * ADVANCE + pad * 2);
}
