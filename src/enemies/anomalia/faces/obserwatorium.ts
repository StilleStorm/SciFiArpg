/**
 * Obserwatorium (Nalesnik's face, STORY 3): the lens sees only round things. Edge-on (the hero rolling, Orbita, and not
 * rounded up) the hero does not exist to it: its existence drops while the hero rolls near it, it cannot hurt them and
 * a hit on it counts for little. Flat, it is fully there: it hurts and is hurt. The fight is choosing when to be flat.
 * It can hurt only a flat hero: while the hero is edge-on its damage multiplier is held at 0 and its attacks wait.
 */
import type { Claim } from '../../../combat/claims';
import type { Enemy } from '../../../entities/types';
import { pinExistence } from '../../hooks';
import { rtOf } from '../../runtime';
import type { RunState } from '../../../world/run';
import type { AnomaliaFace } from '../index';
import { FACE_END_FRACTION, faceStore, hpFraction, restoreClaim, sayLine, setFaceClaim } from './common';
import { NALESNIK } from './heroes';
import { FIGURE_IDS } from './figures';

/** The hero counts as "near" within this many world units. */
export const NEAR = 260;
/** Existence while the hero is edge-on near it, and while flat. */
export const EDGE_EXISTENCE = 0.3;
export const FLAT_EXISTENCE = 1;
/** Damage multiplier on hits while edge-on (flat: 1). */
export const EDGE_DAMAGE_MUL = 0.25;
/** Seconds between two "Nie widzę ciała" notes. */
const NOTE_EVERY = 5;

interface St {
  edge: boolean;
  /** Its damage multiplier before the face held it at 0. */
  dmg: number;
  existence: number | undefined;
  noteAt: number;
  claim: Claim | undefined;
}
const store = faceStore<St>(() => ({ edge: false, dmg: 1, existence: undefined, noteAt: -99, claim: undefined }));

/** The hero is edge-on to the lens: rolling (not rounded up) and near it. */
export function isEdgeOn(s: RunState, e: Enemy): boolean {
  if (!s.hero.roll || s.player.round) return false;
  return Math.hypot(s.player.x - e.x, s.player.y - e.y) <= NEAR;
}

export const edgeOnOf = (e: Enemy): boolean => store.get(e).edge;

export const obserwatorium: AnomaliaFace = {
  heroId: NALESNIK,
  sporAnswer: 'egzystencjalny',
  figure: FIGURE_IDS.obserwatorium,
  start(_s, e) {
    const st = store.get(e);
    st.edge = false;
    st.dmg = rtOf(e).dmgMult;
    st.existence = e.existence;
    st.noteAt = -99;
    st.claim = setFaceClaim(e, NALESNIK, 'egzystencjalny');
    if (e.existence === undefined) e.existence = FLAT_EXISTENCE;
  },
  tick(s, e, bus) {
    const st = store.get(e);
    const edge = isEdgeOn(s, e);
    const rt = rtOf(e);
    if (edge) {
      if (!st.edge) st.dmg = rt.dmgMult;
      rt.dmgMult = 0;
      // it does not see a body: its attacks wait while the hero is edge-on
      if (e.attackTimer < 0.3) e.attackTimer = 0.3;
      if (rt.shootT < 0.3) rt.shootT = 0.3;
      pinExistence(e, EDGE_EXISTENCE, 0.4);
      if (s.time - st.noteAt >= NOTE_EVERY) {
        st.noteAt = s.time;
        sayLine(bus, NALESNIK, e.x, e.y - 100);
      }
    } else if (st.edge) {
      rt.dmgMult = st.dmg;
      pinExistence(e, FLAT_EXISTENCE, 0.4);
    }
    st.edge = edge;
  },
  damageMul(s, e) {
    return isEdgeOn(s, e) ? EDGE_DAMAGE_MUL : 1;
  },
  done: (_s, e) => hpFraction(e) <= FACE_END_FRACTION,
  stop(_s, e) {
    const st = store.get(e);
    if (st.edge) rtOf(e).dmgMult = st.dmg;
    rtOf(e).ePin = null;
    if (st.existence === undefined) delete e.existence;
    else e.existence = st.existence;
    restoreClaim(e, st.claim);
    store.drop(e);
  },
};
