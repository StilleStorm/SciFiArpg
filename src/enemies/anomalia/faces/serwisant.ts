/**
 * Serwisant Autoryzowany (Pralka's face, STORY 3): strips one installed paragraph for ten seconds at a time. It is won back
 * early by rebutting the Serwisant (his bubble is struck through), or when the ten seconds run out. `stop` gives it back.
 */
import type { Claim } from '../../../combat/claims';
import type { DamageType } from '../../../combat/damage';
import type { Bus } from '../../../core/events';
import type { ParagraphNo, ParagraphPatch } from '../../../heroes/paragraphs';
import type { Enemy } from '../../../entities/types';
import type { RunState } from '../../../world/run';
import type { AnomaliaFace } from '../index';
import { FACE_END_FRACTION, faceStore, hpFraction, restoreClaim, sayLine, setFaceClaim } from './common';
import { PRALKA } from './heroes';
import { FIGURE_IDS } from './figures';

export const STRIP_S = 10;
export const STRIP_WAIT_S = 5;
/** After a rebuttal the bubble stands again this many seconds later, so that the next strip can be won back too. */
export const REARM_S = 2.5;
const CLAIM_TYPES: readonly DamageType[] = ['egzystencjalny', 'mechaniczny', 'regulaminowy'];

interface Stripped {
  skill: number;
  para: ParagraphNo;
  patch: ParagraphPatch | undefined;
  left: number;
}
interface St {
  wait: number;
  stripped: Stripped | null;
  rearm: number;
  claimIx: number;
  claim: Claim | undefined;
  unsub: (() => void) | null;
  strips: number;
}
const store = faceStore<St>(() => ({ wait: STRIP_WAIT_S, stripped: null, rearm: 0, claimIx: 0, claim: undefined, unsub: null, strips: 0 }));

export const strippedOf = (e: Enemy): { skill: number; left: number } | null => {
  const st = store.get(e).stripped;
  return st ? { skill: st.skill, left: st.left } : null;
};
export const stripsOf = (e: Enemy): number => store.get(e).strips;

function restore(s: RunState, st: St): void {
  const sp = st.stripped;
  if (!sp) return;
  const h = s.hero;
  const para = (h.para ??= [1, 1, 1, 1, 1]);
  const patch = (h.patch ??= [undefined, undefined, undefined, undefined, undefined]);
  para[sp.skill] = sp.para;
  patch[sp.skill] = sp.patch;
  st.stripped = null;
}

function strip(s: RunState, st: St, bus: Bus, e: Enemy): boolean {
  const para = s.hero.para;
  if (!para) return false;
  const live: number[] = [];
  for (let i = 0; i < para.length; i++) if ((para[i] ?? 1) > 1) live.push(i);
  if (live.length === 0) return false;
  const i = live[s.rngs.ai.int(0, live.length - 1)] ?? live[0] ?? 0;
  const patch = (s.hero.patch ??= [undefined, undefined, undefined, undefined, undefined]);
  st.stripped = { skill: i, para: para[i] ?? 1, patch: patch[i], left: STRIP_S };
  para[i] = 1;
  patch[i] = undefined;
  st.strips++;
  sayLine(bus, e, PRALKA, e.x, e.y - 90);
  return true;
}

export const serwisant: AnomaliaFace = {
  heroId: PRALKA,
  sporAnswer: 'egzystencjalny',
  figure: FIGURE_IDS.serwisant,
  start(s, e, bus) {
    const st = store.get(e);
    st.wait = STRIP_WAIT_S;
    st.stripped = null;
    st.rearm = 0;
    st.strips = 0;
    st.claimIx = 0;
    st.claim = setFaceClaim(e, PRALKA, CLAIM_TYPES[0] ?? 'egzystencjalny');
    st.unsub?.();
    st.unsub = bus.on('enemy:rebutted', ({ id }) => {
      if (id !== e.id) return;
      restore(s, st);
      st.wait = STRIP_WAIT_S;
      st.rearm = REARM_S;
    });
  },
  tick(s, e, bus, dt) {
    const st = store.get(e);
    if (e.claim?.struck && st.rearm <= 0) st.rearm = REARM_S;
    if (st.rearm > 0) {
      st.rearm -= dt;
      if (st.rearm <= 0 && e.claim) {
        st.claimIx = (st.claimIx + 1) % CLAIM_TYPES.length;
        e.claim.struck = false;
        e.claim.type = CLAIM_TYPES[st.claimIx] ?? e.claim.type;
      }
    }
    if (st.stripped) {
      st.stripped.left -= dt;
      if (st.stripped.left <= 0) {
        restore(s, st);
        st.wait = STRIP_WAIT_S;
      }
      return;
    }
    st.wait -= dt;
    if (st.wait <= 0 && !strip(s, st, bus, e)) st.wait = STRIP_WAIT_S;
  },
  damageMul: () => 1,
  done: (_s, e) => hpFraction(e) <= FACE_END_FRACTION,
  stop(s, e) {
    const st = store.get(e);
    st.unsub?.();
    st.unsub = null;
    restore(s, st);
    restoreClaim(e, st.claim);
    store.drop(e);
  },
};

