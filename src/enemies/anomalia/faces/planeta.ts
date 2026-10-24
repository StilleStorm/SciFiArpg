/**
 * Planeta Nieistniejąca (Kartograf's face, STORY 3): only measured parts exist. The body is seven parts (a centre and six
 * sectors); a laser line of the hero (`attack:started` with `laser`) that crosses a part makes it real for MEASURED_S seconds.
 * `damageMul` is 1 on a real part and 0 elsewhere. `realParts` is for the renderer (solid line where real, dotted elsewhere).
 */
import type { Claim } from '../../../combat/claims';
import type { Enemy } from '../../../entities/types';
import type { RunState } from '../../../world/run';
import type { AnomaliaFace } from '../index';
import { FACE_END_FRACTION, faceStore, hpFraction, restoreClaim, sayLine, setFaceClaim } from './common';
import { KARTOGRAF } from './heroes';
import { FIGURE_IDS } from './figures';

export const PARTS = 7;
export const SECTORS = 6;
export const MEASURED_S = 7;
/** Inner disc (part 0) as a fraction of the body's radius, and how far past the body a line still counts. */
export const CENTRE_FRAC = 0.38;
export const REACH_FRAC = 1.25;
/** Seconds between two "Istnieję w nawigacji" margin notes (the laser measures about once a second; the bubble already says it). */
export const NOTE_EVERY = 5;

interface St {
  /** Seconds each part stays real. */
  left: Float64Array;
  claim: Claim | undefined;
  unsub: (() => void) | null;
  marks: number;
  /** Run time of the last margin note. */
  noteAt: number;
}
const store = faceStore<St>(() => ({ left: new Float64Array(PARTS), claim: undefined, unsub: null, marks: 0, noteAt: -99 }));

/** Which part a world point is on, or -1 when it is off the body altogether. Part 0 is the centre, 1..6 the sectors. */
export function partAt(e: Enemy, x: number, y: number): number {
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.hypot(dx, dy);
  if (d > e.r * REACH_FRAC) return -1;
  if (d <= e.r * CENTRE_FRAC) return 0;
  const a = Math.atan2(dy, dx) + Math.PI; // 0..2pi
  return 1 + (Math.floor((a / (Math.PI * 2)) * SECTORS) % SECTORS);
}

export const isReal = (e: Enemy, part: number): boolean => part >= 0 && (store.get(e).left[part] ?? 0) > 0;
export function realParts(e: Enemy): readonly boolean[] {
  const left = store.get(e).left;
  return Array.from(left, (v) => v > 0);
}
export const marksOf = (e: Enemy): number => store.get(e).marks;

/** Make real every part the segment (sx, sy)-(ex, ey) crosses. Sampled; no allocation. */
export function measure(e: Enemy, sx: number, sy: number, ex: number, ey: number): number {
  const left = store.get(e).left;
  let n = 0;
  const steps = Math.max(8, Math.ceil(Math.hypot(ex - sx, ey - sy) / (e.r * 0.25)));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const p = partAt(e, sx + (ex - sx) * k, sy + (ey - sy) * k);
    if (p >= 0) {
      if ((left[p] ?? 0) <= 0) n++;
      left[p] = MEASURED_S;
    }
  }
  store.get(e).marks += n;
  return n;
}

export const planeta: AnomaliaFace = {
  heroId: KARTOGRAF,
  sporAnswer: 'mechaniczny',
  figure: FIGURE_IDS.planeta,
  start(s: RunState, e, bus) {
    const st = store.get(e);
    st.left.fill(0);
    st.marks = 0;
    st.noteAt = -99;
    st.claim = setFaceClaim(e, KARTOGRAF, 'mechaniczny');
    st.unsub?.();
    st.unsub = bus.on('attack:started', (a) => {
      if (a.attacker !== 'player' || !a.laser) return;
      if (measure(e, a.laser.sx, a.laser.sy, a.laser.ex, a.laser.ey) > 0 && s.time - st.noteAt >= NOTE_EVERY) {
        st.noteAt = s.time;
        sayLine(bus, KARTOGRAF, e.x, e.y - 100);
      }
    });
  },
  tick(_s, e, _bus, dt) {
    const left = store.get(e).left;
    for (let i = 0; i < PARTS; i++) if ((left[i] ?? 0) > 0) left[i] = Math.max(0, (left[i] ?? 0) - dt);
  },
  damageMul(_s, e, x, y) {
    return isReal(e, partAt(e, x, y)) ? 1 : 0;
  },
  parts: realParts,
  done: (_s, e) => hpFraction(e) <= FACE_END_FRACTION,
  stop(_s, e) {
    const st = store.get(e);
    st.unsub?.();
    st.unsub = null;
    restoreClaim(e, st.claim);
    store.drop(e);
  },
};
