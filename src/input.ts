import type { Vec } from './core/vec';

export interface Input {
  /** Client coordinates of the finger while it is down, else null. */
  held(): Vec | null;
  setEnabled(on: boolean): void;
}

/** Pointer events on the stage: tap = walk there, hold = keep walking toward the finger. */
export function createInput(svg: SVGSVGElement, onDown: (clientX: number, clientY: number) => void): Input {
  let enabled = false;
  let pointerId: number | null = null;
  const pos: Vec = { x: 0, y: 0 };

  svg.addEventListener('pointerdown', (ev) => {
    if (!enabled || pointerId !== null || !ev.isPrimary) return;
    ev.preventDefault();
    pointerId = ev.pointerId;
    pos.x = ev.clientX;
    pos.y = ev.clientY;
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch {
      // capture is a nicety; synthetic pointers may refuse it
    }
    onDown(ev.clientX, ev.clientY);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== pointerId) return;
    pos.x = ev.clientX;
    pos.y = ev.clientY;
  });
  const release = (ev: PointerEvent): void => {
    if (ev.pointerId === pointerId) pointerId = null;
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  return {
    held: () => (pointerId === null ? null : pos),
    setEnabled(on) {
      enabled = on;
      if (!on) pointerId = null;
    },
  };
}
