/**
 * Stereo placement of combat sounds: the source's screen x relative to the camera centre, as a StereoPanner value.
 * UI and menu foley and the music are never panned (centre).
 */
/** The widest the pan goes: a source at the edge of the view sits 60% to that side, never hard left or right. */
export const MAX_PAN = 0.6;
/** The view width assumed when the game does not report the camera (portrait: 390 world units across). */
export const DEFAULT_VIEW_W = 390;

/** Pan for a source at world x `x` seen by a camera centred on `camX` that shows `viewW` units across. Pure; -MAX_PAN..MAX_PAN. */
export function panFor(x: number, camX: number, viewW: number = DEFAULT_VIEW_W): number {
  if (!Number.isFinite(x) || !Number.isFinite(camX) || !(viewW > 0)) return 0;
  const k = (x - camX) / (viewW / 2);
  return Math.max(-MAX_PAN, Math.min(MAX_PAN, k * MAX_PAN));
}
