import type { Bus } from '../core/events';
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { isFreeLimited } from './stats';
import { SLOTS } from './types';

/** Seconds between advertisements while a free-version item is past its trial. */
export const AD_PERIOD = 30;
export const AD_COUNT = 6;

const state = new WeakMap<object, { clock: number; next: number }>();

/** Is any equipped, working item a free version past its trial and not bought out? */
export function adsActive(p: Pick<Player, 'equipment'>): boolean {
  for (const slot of SLOTS) {
    const item = p.equipment[slot];
    if (item && isFreeLimited(item) && !(item.blockedBy && !item.adapter)) return true;
  }
  return false;
}

/** Footnote advertisement every AD_PERIOD seconds. The clock only runs while ads are active. */
export function tickAds(p: Player, bus: Bus, dt: number): void {
  const st = state.get(p) ?? { clock: 0, next: 1 };
  state.set(p, st);
  if (!adsActive(p)) {
    st.clock = 0;
    return;
  }
  st.clock += dt;
  if (st.clock < AD_PERIOD) return;
  st.clock -= AD_PERIOD;
  bus.emit('footnote', { text: t(`items.ads.a${st.next}`) });
  st.next = (st.next % AD_COUNT) + 1;
}
