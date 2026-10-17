/** The exit dog-ear is not printed on the page until it is seen: drawn in when the player is near (the Kartograf: at once). */
import { exitVisible } from '../world/pages';
import type { RunState } from '../world/run';
import { drawIn } from './ink';

const DRAW_MS = 520;

export interface ExitReveal {
  /** Call every rendered frame. Cheap: one distance check; the element is looked up once per page. */
  frame(s: RunState): void;
}

export function createExitReveal(pageLayer: SVGGElement): ExitReveal {
  let index = -1;
  let el: SVGGElement | null = null;
  let shown = false;
  return {
    frame(s) {
      if (s.pageIndex !== index || !el || !el.isConnected) {
        index = s.pageIndex;
        el = pageLayer.querySelector<SVGGElement>('[data-exit]');
        shown = false;
        if (el) el.style.opacity = '0';
      }
      if (!el || shown || s.turning) return;
      if (!exitVisible(s.page, s.player, s.player.revealsPage)) return;
      shown = true;
      el.style.opacity = '1';
      drawIn(el, DRAW_MS);
    },
  };
}
