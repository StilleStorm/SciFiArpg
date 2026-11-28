import type { Vec } from './core/vec';
import type { Steering } from './ui/layout';
import type { Joystick, Steer } from './ui/joystick';

export interface Input {
  /** Tap mode: client coordinates of the finger while it is down, else null. */
  held(): Vec | null;
  /** Joystick mode: the steering while a thumb is on the steering half, else null. */
  steer(): Steer | null;
  setEnabled(on: boolean): void;
  /** Tap on the page = walk there; joystick = a floating stick on the steering half. */
  setMode(mode: Steering): void;
  /** Left-handed: the steering half is the right one. */
  setLeftHanded(on: boolean): void;
  /** Test hook: steer as if the stick was held (null lets go). A real thumb on the stick wins. */
  inject(steer: Steer | null): void;
  /** Keyboard (ui/keys.ts): the arrows as a full-speed vector, null when no direction key is held. Wins over the stick and over a tap walk. */
  setKeys(steer: Steer | null): void;
  /**
   * Desktop "mysz" (ui/keys.ts), asked on each mouse press. True = the mouse plays Diablo-style: the press goes to `onMouse` (not to
   * the tap walk or the stick) and `mouse()` reports the held button until it is let go. Touch and pen never take this path.
   */
  setMouseAims(aims: () => boolean): void;
  /** The mouse button held now in "mysz" (left and right are the same): cursor (client px), stand = Shift, force = Ctrl; null when none is held. */
  mouse(): MouseHold | null;
  /** True while pointer input is on (no sheet, card or pause holds the page). */
  enabled(): boolean;
}

export interface MouseHold {
  x: number;
  y: number;
  /** Shift: attack where it points, do not walk. */
  stand: boolean;
  /** Ctrl: walk to the point even over an enemy. */
  force: boolean;
}

/** A touch shorter than this and shorter than TAP_SLOP px is a tap, not a steering gesture. */
const TAP_MS = 260;
const TAP_SLOP = 10;

interface Touch {
  x: number;
  y: number;
  t: number;
}

/**
 * Pointer events on the stage. Tap mode: tap = walk there, hold = keep walking toward the finger.
 * Joystick mode: the pointer that lands on the steering half steers; any other pointer (a pad is a button
 * and never reaches the stage) stays independent, so steering and pad taps work at the same time.
 * In joystick mode a quick tap does not walk: it is passed on as a tap that walks nowhere (the kiosk still hears it).
 */
export function createInput(
  svg: SVGSVGElement,
  onTap: (clientX: number, clientY: number, walk: boolean) => void,
  joystick?: Joystick,
  onMouse?: (hold: MouseHold) => void,
): Input {
  let enabled = false;
  let mode: Steering = 'tap';
  let lefty = false;
  let pointerId: number | null = null; // tap mode: the walking finger
  let steerId: number | null = null; // joystick mode: the steering finger
  const pos: Vec = { x: 0, y: 0 };
  const touches = new Map<number, Touch>(); // joystick mode: candidates for a quick tap
  let injected: Steer | null = null;
  let keys: Steer | null = null;
  let mouseAims: () => boolean = () => false;
  let mouseId: number | null = null; // "mysz": the mouse while a button is held
  let mouseHold: MouseHold = { x: 0, y: 0, stand: false, force: false };

  const onSteeringHalf = (clientX: number): boolean => (lefty ? clientX >= window.innerWidth / 2 : clientX < window.innerWidth / 2);
  const capture = (id: number): void => {
    try {
      svg.setPointerCapture(id);
    } catch {
      // capture is a nicety; synthetic pointers may refuse it
    }
  };
  const releaseAll = (): void => {
    pointerId = null;
    steerId = null;
    mouseId = null;
    touches.clear();
    joystick?.end();
  };

  svg.addEventListener('pointerdown', (ev) => {
    if (!enabled) return;
    if (ev.pointerType === 'mouse' && mouseAims()) {
      ev.preventDefault();
      if (mouseId !== null || (ev.button !== 0 && ev.button !== 2)) return;
      mouseId = ev.pointerId;
      capture(ev.pointerId);
      mouseHold = { x: ev.clientX, y: ev.clientY, stand: ev.shiftKey, force: ev.ctrlKey };
      onMouse?.(mouseHold);
      return;
    }
    if (mode === 'joystick') {
      ev.preventDefault();
      capture(ev.pointerId);
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
      if (steerId === null && onSteeringHalf(ev.clientX)) {
        steerId = ev.pointerId;
        joystick?.begin(ev.clientX, ev.clientY);
      }
      return;
    }
    if (pointerId !== null || !ev.isPrimary) return;
    ev.preventDefault();
    pointerId = ev.pointerId;
    pos.x = ev.clientX;
    pos.y = ev.clientY;
    capture(ev.pointerId);
    onTap(ev.clientX, ev.clientY, true);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (ev.pointerId === mouseId) {
      // Shift held now: stand; let go, it walks again
      mouseHold = { x: ev.clientX, y: ev.clientY, stand: ev.shiftKey, force: ev.ctrlKey };
    } else if (ev.pointerId === steerId) joystick?.move(ev.clientX, ev.clientY);
    else if (ev.pointerId === pointerId) {
      pos.x = ev.clientX;
      pos.y = ev.clientY;
    }
  });
  const release = (ev: PointerEvent): void => {
    if (ev.pointerId === pointerId) pointerId = null;
    if (ev.pointerId === mouseId) mouseId = null;
    const start = touches.get(ev.pointerId);
    if (start) {
      touches.delete(ev.pointerId);
      if (ev.pointerId === steerId) {
        steerId = null;
        joystick?.end();
      }
      const quick = ev.type === 'pointerup' && ev.timeStamp - start.t <= TAP_MS && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= TAP_SLOP;
      if (quick && enabled) onTap(ev.clientX, ev.clientY, false);
    }
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  return {
    held: () => (pointerId === null || (enabled && keys) ? null : pos),
    steer: () => (enabled && keys ? keys : steerId === null ? (mode === 'joystick' ? injected : null) : (joystick?.steer() ?? null)),
    inject(steer) {
      injected = steer;
    },
    setKeys(steer) {
      keys = steer;
    },
    setMouseAims(aims) {
      mouseAims = aims;
    },
    mouse: () => (enabled && mouseId !== null ? mouseHold : null),
    enabled: () => enabled,
    setEnabled(on) {
      enabled = on;
      if (!on) {
        injected = null;
        releaseAll();
      }
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      injected = null;
      releaseAll();
    },
    setLeftHanded(on) {
      lefty = on;
    },
  };
}
