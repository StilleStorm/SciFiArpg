/**
 * Props stand on the page under the screen furniture (the margin-note buttons, the pads, the corner HUD), which is
 * screen-fixed while the camera moves, so some prop is always under some button. A prop whose footprint a block covers
 * fades back to a faint print and returns when the camera has moved on (S28c). Footprints are stamped on each prop's group
 * at draw time (`data-fx0..fy1`, page units), so a frame is a few rectangle tests and no layout read.
 */
import { overlaps, type Box } from './keepOut';

export const FOOT_ATTRS = ['fx0', 'fy0', 'fx1', 'fy1'] as const;

/** Whether the footprint touches any of the blocks. Pure. */
export function coveredBy(foot: Box, blocks: readonly Box[]): boolean {
  return blocks.some((b) => overlaps(foot, b));
}

export interface PropYield {
  /** Call every rendered frame outside the base with the blocks in page units (`keepOutBlocks(camera)`). */
  frame(blocks: readonly Box[]): void;
}

interface Tracked {
  el: SVGGElement;
  foot: Box;
  yielded: boolean;
}

export function createPropYield(pageLayer: SVGGElement): PropYield {
  let ink: Element | null = null;
  let props: Tracked[] = [];
  return {
    frame(blocks) {
      const now = pageLayer.querySelector(':scope > [data-page-ink]');
      if (now !== ink) {
        ink = now;
        props = [];
        for (const el of now?.querySelectorAll<SVGGElement>('[data-obstacle="prop"][data-fx0]') ?? []) {
          const [x0, y0, x1, y1] = FOOT_ATTRS.map((a) => Number(el.dataset[a]));
          if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) continue;
          props.push({ el, foot: { x0, y0, x1, y1 }, yielded: false });
        }
      }
      for (const p of props) {
        const c = coveredBy(p.foot, blocks);
        if (c === p.yielded) continue;
        p.yielded = c;
        p.el.classList.toggle('yield', c);
      }
    },
  };
}
