import { AUTO_AIM, type Aim, type Point } from '../heroes/aim';
import type { Steer } from './joystick';
import './keys.css';

/**
 * Desktop keyboard and mouse (DESIGN 2, S29). The phone controls stay; a keyboard adds to them. Everything here is a
 * thin listener over the same paths the pointer uses: the joystick vector (`input.setKeys`), the pad press/release
 * (`ui/pads.ts`) and the sheet openers handed in by main.ts. No game logic lives here.
 */

export type KeyAction =
  | { kind: 'pad'; slot: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'pause' }
  | { kind: 'inventory' }
  | { kind: 'tunnel' }
  | { kind: 'potw' };

/** Only the arrows steer: Q W E R are the skills (the mouse walks, DESIGN 2). */
const DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** The steering for the direction keys held now (`KeyboardEvent.code` values): full speed, diagonals normalised, opposite keys cancel; null when it adds up to nothing. */
export function keyVector(held: Iterable<string>): Steer | null {
  let x = 0;
  let y = 0;
  const seen = new Set<string>(); // the same direction twice is one push, not two
  for (const code of held) {
    const d = DIRECTIONS[code];
    if (!d) continue;
    const id = `${d[0]},${d[1]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    x += d[0];
    y += d[1];
  }
  const len = Math.hypot(x, y);
  if (len === 0) return null;
  return { dx: x / len, dy: y / len, mag: 1 };
}

/** The pad keys: Q W E the three skill pads, R the ultimate. */
const PAD_KEYS: Readonly<Record<string, 1 | 2 | 3 | 4>> = { KeyQ: 1, KeyW: 2, KeyE: 3, KeyR: 4 };

/** What a key (`KeyboardEvent.code`) asks for, or null. 1 (and numpad 1) uses the held item like F; 2 and 3 are kept for later items. */
export function keyAction(code: string): KeyAction | null {
  const slot = PAD_KEYS[code];
  if (slot) return { kind: 'pad', slot };
  switch (code) {
    case 'Digit1':
    case 'Numpad1':
      return { kind: 'potw' };
    case 'Escape':
      return { kind: 'pause' };
    case 'KeyI':
      return { kind: 'inventory' };
    case 'KeyT':
      return { kind: 'tunnel' };
    case 'KeyF':
      return { kind: 'potw' };
    default:
      return null;
  }
}

/** The key numeral drawn on a pad, by the pad's class (s1..s3, ult, inv). */
export const PAD_KEY_LABEL: Readonly<Record<string, string>> = { s1: 'Q', s2: 'W', s3: 'E', ult: 'R', inv: 'I' };

/**
 * The aim of a pad key held in "mysz": kierunek = the unit vector from the hero to the cursor; wskazanie = the cursor point
 * (world units) held to `range` from the hero. Auto skills, and a cursor on the hero, give the auto aim.
 */
export function mouseAim(mode: 'auto' | 'kierunek' | 'wskazanie', hero: Point, cursor: Point, range: number): Aim {
  if (mode === 'auto') return AUTO_AIM;
  const vx = cursor.x - hero.x;
  const vy = cursor.y - hero.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return AUTO_AIM;
  if (mode === 'kierunek') return { kind: 'kierunek', dx: vx / len, dy: vy / len };
  if (len <= range) return { kind: 'wskazanie', x: cursor.x, y: cursor.y };
  return { kind: 'wskazanie', x: hero.x + (vx / len) * range, y: hero.y + (vy / len) * range };
}

// ---------- session state: has a keyboard / a mouse been seen, where is the cursor ----------

let keyboardSeen = false;
let mouseSeen = false;
let cursor: Point | null = null;
let toWorld: ((x: number, y: number) => Point) | null = null;
let aimSetting: 'auto' | 'mysz' | undefined;

/** True once a key was pressed or a fine-pointer mouse moved this session: the "Celowanie" line appears in Ustawienia. */
export const keysSeen = (): boolean => keyboardSeen || mouseSeen;
export const keyboardWasSeen = (): boolean => keyboardSeen;

/**
 * The setting "Celowanie" (`Settings.aim`): 'mysz' = the mouse plays (input.ts / game.ts: click walks, click on an enemy attacks it (left
 * and right buttons alike), Shift stands and attacks, Ctrl walks regardless; pad keys and the auto-attack aim at the cursor). Unset, it follows
 * the desk: mysz once a fine-pointer mouse moved, else auto. Touch never changes.
 */
export function setAimMode(mode: 'auto' | 'mysz' | undefined): void {
  aimSetting = mode;
}
export const aimsAtMouse = (): boolean => (aimSetting ?? (mouseSeen ? 'mysz' : 'auto')) === 'mysz';

/** The cursor in world units now, or null before the mouse moved (or without a camera). */
export function cursorWorld(): Point | null {
  return cursor && toWorld ? toWorld(cursor.x, cursor.y) : null;
}

/** Test hook: put the cursor at client px (as a mouse move would). */
export function moveCursor(x: number, y: number): void {
  cursor = { x, y };
  mouseSeen = true;
}

function markKeyboard(): void {
  if (keyboardSeen) return;
  keyboardSeen = true;
  document.documentElement.setAttribute('data-keys', '1');
}

export interface KeyHandlers {
  input: { setKeys(s: Steer | null): void; enabled(): boolean };
  /** client px -> world units (the camera's screenToWorld). */
  toWorld(x: number, y: number): Point;
  /** A pad key went down: the pad is held (aiming at the cursor in "mysz"). */
  padDown(slot: 1 | 2 | 3 | 4 | 5): void;
  /** The pad key came up (commit: fire) or the press was broken off (blur). */
  padUp(slot: 1 | 2 | 3 | 4 | 5, commit: boolean): void;
  /** Esc: close the sheet that is up, else toggle the pause sheet. */
  escape(): void;
  inventory(): void;
  tunnel(): void;
  potw(): void;
}

const inFormControl = (t: EventTarget | null): boolean => t instanceof HTMLElement && t.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

/** Install the keyboard map and the cursor tracking on the window. Returns the remover. */
export function installKeys(h: KeyHandlers): () => void {
  toWorld = h.toWorld;
  const down = new Set<string>();
  const padsDown = new Set<1 | 2 | 3 | 4 | 5>();
  const push = (): void => h.input.setKeys(keyVector(down));
  const clear = (): void => {
    down.clear();
    push();
    for (const slot of padsDown) h.padUp(slot, false);
    padsDown.clear();
  };

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const dir = DIRECTIONS[ev.code];
    const act = keyAction(ev.code);
    if (!dir && !act) return;
    markKeyboard();
    if (inFormControl(ev.target) && act?.kind !== 'pause') return;
    ev.preventDefault();
    if (dir) {
      down.add(ev.code);
      push();
      return;
    }
    if (!act || ev.repeat) return;
    switch (act.kind) {
      case 'pause':
        clear();
        h.escape();
        break;
      case 'inventory':
        h.inventory();
        break;
      case 'tunnel':
        if (h.input.enabled()) h.tunnel();
        break;
      case 'potw':
        if (h.input.enabled()) h.potw();
        break;
      case 'pad':
        if (!h.input.enabled() || padsDown.has(act.slot)) break;
        padsDown.add(act.slot);
        h.padDown(act.slot);
        break;
    }
  };
  const onKeyUp = (ev: KeyboardEvent): void => {
    if (down.delete(ev.code)) push();
    const act = keyAction(ev.code);
    if (act?.kind === 'pad' && padsDown.delete(act.slot)) h.padUp(act.slot, true);
  };
  const onPointerMove = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'mouse') return;
    cursor = { x: ev.clientX, y: ev.clientY };
    if (!mouseSeen && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) mouseSeen = true;
  };
  // Right click is a game button (the same as the left), not the browser's menu; a text field keeps its menu.
  const onContextMenu = (ev: MouseEvent): void => {
    if (!inFormControl(ev.target)) ev.preventDefault();
  };
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden') clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('blur', clear);
  window.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('visibilitychange', onHidden);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('blur', clear);
    window.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('visibilitychange', onHidden);
    clear();
    h.input.setKeys(null);
  };
}
