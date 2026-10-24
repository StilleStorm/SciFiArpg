/**
 * Węzeł (Petlowiec's face, STORY 3): the page rewinds three seconds when the Węzeł is hurt below a threshold. A bounded ring
 * of samples (hero and Węzeł: position and racja) is kept at 10 Hz in preallocated arrays; a rewind puts both back where they
 * were, never lowering the hero's racja and never lowering the Węzeł's. Each threshold fires once; a right Spór reply
 * (mechaniczny: the knot has an end) spends the rest.
 */
import type { Claim } from '../../../combat/claims';
import type { Enemy } from '../../../entities/types';
import type { AnomaliaFace } from '../index';
import { FACE_END_FRACTION, faceStore, hpFraction, restoreClaim, sayLine, setFaceClaim } from './common';
import { PETLOWIEC } from './heroes';
import { FIGURE_IDS } from './figures';

export const REWIND_S = 3;
export const SAMPLE_STEP = 0.1;
/** Samples kept: REWIND_S plus a little slack. */
export const RING_N = Math.ceil(REWIND_S / SAMPLE_STEP) + 3;
/** The Węzeł's racja fractions below which the page rewinds (each once). */
export const REWIND_BELOW: readonly number[] = [0.85, 0.7];
const W = 7; // t, hx, hy, hhp, ex, ey, ehp

interface St {
  buf: Float64Array;
  head: number;
  count: number;
  acc: number;
  used: number;
  claim: Claim | undefined;
  unsub: (() => void) | null;
  rewinds: number;
}
const store = faceStore<St>(() => ({ buf: new Float64Array(RING_N * W), head: 0, count: 0, acc: SAMPLE_STEP, used: 0, claim: undefined, unsub: null, rewinds: 0 }));

export const rewindsOf = (e: Enemy): number => store.get(e).rewinds;
export const ringSizeOf = (e: Enemy): number => store.get(e).buf.length / W;

/** Index (0 = oldest) -> slot in the ring. */
const slot = (st: St, i: number): number => ((st.head - st.count + i + RING_N * 2) % RING_N) * W;

export const wezel: AnomaliaFace = {
  heroId: PETLOWIEC,
  sporAnswer: 'mechaniczny',
  figure: FIGURE_IDS.wezel,
  start(_s, e, bus) {
    const st = store.get(e);
    st.head = 0;
    st.count = 0;
    st.acc = SAMPLE_STEP;
    st.used = 0;
    st.rewinds = 0;
    st.claim = setFaceClaim(e, PETLOWIEC, 'mechaniczny');
    st.unsub?.();
    st.unsub = bus.on('spor:answered', ({ right }) => {
      if (right) st.used = REWIND_BELOW.length;
    });
  },
  tick(s, e, bus, dt) {
    const st = store.get(e);
    st.acc += dt;
    if (st.acc >= SAMPLE_STEP) {
      st.acc -= SAMPLE_STEP;
      const b = st.buf;
      const o = st.head * W;
      b[o] = s.time;
      b[o + 1] = s.player.x;
      b[o + 2] = s.player.y;
      b[o + 3] = s.player.hp;
      b[o + 4] = e.x;
      b[o + 5] = e.y;
      b[o + 6] = e.hp;
      st.head = (st.head + 1) % RING_N;
      if (st.count < RING_N) st.count++;
    }
    const thr = REWIND_BELOW[st.used];
    if (thr === undefined || hpFraction(e) >= thr || st.count < 2) return;
    // the oldest sample at least REWIND_S back, else the oldest there is
    let pick = 0;
    for (let i = st.count - 1; i >= 0; i--) {
      if (s.time - (st.buf[slot(st, i)] ?? s.time) >= REWIND_S) {
        pick = i;
        break;
      }
    }
    const o = slot(st, pick);
    const b = st.buf;
    s.player.x = b[o + 1] ?? s.player.x;
    s.player.y = b[o + 2] ?? s.player.y;
    s.player.target = null;
    s.player.hp = Math.max(s.player.hp, Math.min(s.player.hpMax, b[o + 3] ?? 0));
    e.x = b[o + 4] ?? e.x;
    e.y = b[o + 5] ?? e.y;
    e.hp = Math.max(e.hp, Math.min(e.hpMax, b[o + 6] ?? 0));
    st.used++;
    st.rewinds++;
    st.count = 0; // the page starts being written again from here
    sayLine(bus, PETLOWIEC, e.x, e.y - 90);
  },
  damageMul: () => 1,
  done: (_s, e) => hpFraction(e) <= FACE_END_FRACTION,
  stop(_s, e) {
    const st = store.get(e);
    st.unsub?.();
    st.unsub = null;
    restoreClaim(e, st.claim);
    store.drop(e);
  },
};
