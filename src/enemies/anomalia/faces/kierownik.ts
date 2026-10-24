/**
 * Kierownik Kolejki (Konsultant's face, STORY 3): puts the hero on hold (wyciszony, no skills) and, when the hold
 * runs out, transfers them across the page. Cycle: wait, hold, transfer, wait. `stop` takes the hold off.
 */
import { applyStatus, getStatus } from '../../../combat/status';
import { resolveMove } from '../../../world/pages';
import type { Enemy } from '../../../entities/types';
import type { RunState } from '../../../world/run';
import type { AnomaliaFace } from '../index';
import { FACE_END_FRACTION, faceStore, hpFraction, restoreClaim, sayLine, setFaceClaim } from './common';
import type { Claim } from '../../../combat/claims';
import { KONSULTANT } from './heroes';
import { FIGURE_IDS } from './figures';

export const HOLD_WAIT_S = 7;
export const HOLD_S = 2.5;
/** A transfer never lands this close to the Kierownik. */
export const TRANSFER_MIN_DIST = 220;

interface St {
  /** Seconds to the next hold (waiting) or to the end of the hold (holding). */
  t: number;
  holding: boolean;
  claim: Claim | undefined;
  transfers: number;
}
const store = faceStore<St>(() => ({ t: HOLD_WAIT_S, holding: false, claim: undefined, transfers: 0 }));

export const transfersOf = (e: Enemy): number => store.get(e).transfers;

/** Where the hero is put: the far side of the page from where they stand, kept clear of the Kierownik and of obstacles. */
export function transferPoint(s: RunState, e: Enemy): { x: number; y: number } {
  const p = s.player;
  const page = s.page;
  const cands = [
    { x: page.w - p.x, y: page.h - p.y },
    { x: page.w - p.x, y: p.y },
    { x: p.x, y: page.h - p.y },
    { x: page.w / 2, y: page.h - e.y },
  ];
  let best = { x: p.x, y: p.y };
  let bestD = -1;
  for (const c of cands) {
    const pos = { x: c.x, y: c.y };
    resolveMove(page, pos, p.r);
    const d = Math.hypot(pos.x - e.x, pos.y - e.y);
    if (d >= TRANSFER_MIN_DIST) return pos;
    if (d > bestD) {
      bestD = d;
      best = pos;
    }
  }
  return best;
}

function releaseHold(s: RunState, e: Enemy): void {
  const st = getStatus(s.player, 'wyciszony');
  if (st && st.source === e.id) s.player.statuses.splice(s.player.statuses.indexOf(st), 1);
}

export const kierownik: AnomaliaFace = {
  heroId: KONSULTANT,
  sporAnswer: 'regulaminowy',
  figure: FIGURE_IDS.kierownik,
  start(_s, e) {
    const st = store.get(e);
    st.t = HOLD_WAIT_S;
    st.holding = false;
    st.transfers = 0;
    st.claim = setFaceClaim(e, KONSULTANT, 'regulaminowy');
  },
  tick(s, e, bus, dt) {
    const st = store.get(e);
    st.t -= dt;
    if (st.t > 0) return;
    if (!st.holding) {
      st.holding = true;
      st.t = HOLD_S;
      applyStatus(s.player, 'wyciszony', HOLD_S, e.id);
      sayLine(bus, e, KONSULTANT, e.x, e.y - 90);
      return;
    }
    const to = transferPoint(s, e);
    s.player.x = to.x;
    s.player.y = to.y;
    s.player.target = null;
    st.holding = false;
    st.t = HOLD_WAIT_S;
    st.transfers++;
    releaseHold(s, e);
  },
  damageMul: () => 1,
  done: (_s, e) => hpFraction(e) <= FACE_END_FRACTION,
  stop(s, e) {
    const st = store.get(e);
    releaseHold(s, e);
    restoreClaim(e, st.claim);
    store.drop(e);
  },
};
