/**
 * The printed clause header lies on the page, under the world layer, so a figure that walks across it overprints the
 * text. While anything stands over its box the header yields: it fades to a faint print and comes back when the figure
 * has gone. The test is a rectangle against circles; the fade is a CSS transition on opacity (style.css `.page-header`).
 */
import type { Box } from './keepOut';

export interface Body {
  x: number;
  y: number;
  r: number;
}

/** Whether any body's circle (grown by `slack`) touches the box. Pure. */
export function headerCovered(box: Box, bodies: readonly Body[], slack = 6): boolean {
  return bodies.some((b) => {
    const nx = Math.max(box.x0, Math.min(b.x, box.x1));
    const ny = Math.max(box.y0, Math.min(b.y, box.y1));
    return Math.hypot(b.x - nx, b.y - ny) < b.r + slack;
  });
}

export interface HeaderYield {
  /** Call every rendered frame outside the base: one query per page, one box test per figure. */
  frame(bodies: readonly Body[]): void;
}

export function createHeaderYield(pageLayer: SVGGElement): HeaderYield {
  let el: SVGGElement | null = null;
  let box: Box | null = null;
  let yielded = false;
  return {
    frame(bodies) {
      if (!el || !el.isConnected) {
        el = pageLayer.querySelector<SVGGElement>('.page-header');
        yielded = false;
        box = null;
        if (el) {
          const { x0, y0, x1, y1 } = el.dataset;
          if (x0 !== undefined && y0 !== undefined && x1 !== undefined && y1 !== undefined) box = { x0: Number(x0), y0: Number(y0), x1: Number(x1), y1: Number(y1) };
        }
      }
      if (!el || !box) return;
      const now = headerCovered(box, bodies);
      if (now === yielded) return;
      yielded = now;
      el.classList.toggle('yield', now);
    },
  };
}
