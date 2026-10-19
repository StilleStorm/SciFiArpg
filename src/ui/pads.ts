import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import { heroDef, PAD_SLOTS, type HeroId, type PadSlot, type SkillDef, type SkillIndex } from '../heroes';
import { padSkill } from '../heroes/loadout';
import { DEFAULT_HERO_ID, heroById } from '../heroes/registry';
import {
  AUTO_AIM,
  clearQueuedAim,
  DRAG_START_PX,
  dragToAim,
  isCancel,
  previewOf,
  queueAim,
  reachOf,
  resolveAim,
  TAP_MS,
  trackedRun,
  type Aim,
  type Point,
} from '../heroes/aim';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { hideAim, showAim } from '../render/aimFx';
import { el, wobblyCircle } from '../render/svg';
import { h } from './dom';
import './forms.css';

type PadId = 'skill1' | 'skill2' | 'skill3' | 'inventory';

/** A click this soon after a pointerdown on the same pad is the tail of that press, not a second cast. */
const CLICK_AFTER_PRESS_MS = 700;

const INVENTORY_DRAWING = 'M-5 11V-8A5 5 0 0 1 5-8V8A3 3 0 0 1-1 8V-4'; // paper clip

const PADS: PadId[] = ['skill1', 'skill2', 'skill3', 'inventory'];
const SLOT_CLASS: Record<PadId, string> = { skill1: 's1', skill2: 's2', skill3: 's3', inventory: 'inv' };
const EVENT: Record<PadId, 'skill:1' | 'skill:2' | 'skill:3' | 'inventory'> = {
  skill1: 'skill:1',
  skill2: 'skill:2',
  skill3: 'skill:3',
  inventory: 'inventory',
};

/** A finger on a skill pad: where it landed, where it is, and whether it has dragged far enough to aim. */
interface Press {
  id: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  t0: number;
  aiming: boolean;
}

interface PadNode {
  btn: HTMLButtonElement;
  svg: SVGSVGElement;
  glyph: SVGGElement;
  word: HTMLElement;
  ring: SVGPathElement;
  /** The two circle strokes; drawn thicker while the pad is aiming. */
  circles: SVGPathElement[];
  thick: boolean;
  last: number;
  press: Press | null;
  /** Removes the window listeners of a real pointer press. */
  release: (() => void) | null;
  pressedAt: number;
}
const nodes: PadNode[] = [];
let currentHero: HeroId | null = null;
let busRef: Bus | null = null;
/** The pad whose preview is on the page (the last aimed pad pressed). */
let drawer: number | null = null;
let frame = 0;

function drawGlyph(g: SVGGElement, strokes: readonly string[]): void {
  g.replaceChildren(
    ...strokes.map((d) => {
      const dotted = d.startsWith('~');
      return el('path', dotted ? { d: d.slice(1), 'stroke-dasharray': '2 3' } : { d });
    }),
  );
}

/** The skill each pad shows now (SkillIndex per pad); `syncPads` keeps it equal to `s.hero.pads`. */
let shownPads: readonly [SkillIndex, SkillIndex, SkillIndex] = [0, 1, 2];

/** Put the word, the label and the glyph of skill `sk` of this hero on pad `slot`. */
function drawPad(heroId: HeroId, slot: PadSlot, sk: SkillIndex): void {
  const n = nodes[slot];
  if (!n) return;
  const def = heroDef(heroId).skills[sk];
  n.word.textContent = t(def.padKey);
  n.btn.setAttribute('aria-label', t(def.nameKey));
  drawGlyph(n.glyph, heroById(heroId).pads[sk]);
  n.last = -2; // the ring is redrawn for the skill that is here now
}

/** Show the skill drawings and words of this hero on the three pads (the default order; `syncPads` follows the run's pads). */
export function setPadHero(heroId: HeroId): void {
  if (currentHero === heroId) return;
  currentHero = heroId;
  shownPads = [0, 1, 2];
  for (const slot of PAD_SLOTS) drawPad(heroId, slot, slot);
}

/**
 * Every frame: when the hero or the pad assignment changed since the last call, redraw the words, labels and glyphs.
 * Otherwise it only compares four values.
 */
export function syncPads(s: RunState): void {
  const hero = s.player.heroId;
  const pads = s.hero.pads;
  if (currentHero === hero && pads[0] === shownPads[0] && pads[1] === shownPads[1] && pads[2] === shownPads[2]) return;
  currentHero = hero;
  shownPads = [pads[0], pads[1], pads[2]];
  for (const slot of PAD_SLOTS) drawPad(hero, slot, shownPads[slot]);
}

/** Cooldown rings: the circle around a pad is drawn as the cooldown runs out; the cooldown belongs to the skill the pad holds. Call every frame. */
export function updatePadCooldowns(cd: readonly number[], total: readonly number[]): void {
  for (const slot of PAD_SLOTS) {
    const n = nodes[slot];
    if (!n) continue;
    const skill = shownPads[slot];
    const left = cd[skill] ?? 0;
    const len = Math.max(0.01, total[skill] ?? 1);
    const offset = left > 0 ? Math.round((left / len) * 200) / 2 : -1;
    if (offset === n.last) continue;
    n.last = offset;
    const cooling = left > 0;
    n.btn.classList.toggle('cooling', cooling);
    if (cooling) n.ring.style.strokeDashoffset = String(offset);
  }
}

// ---------- hold, drag, release (DESIGN 5.6) ----------

/** The skill pad `slot` holds in the tracked run (the one the pad fires), if a run is tracked. */
function skillOf(slot: number): SkillDef | undefined {
  const s = trackedRun();
  return s && slot >= 0 && slot <= 2 ? padSkill(s, slot as PadSlot) : undefined;
}

/** The pad's circle centre in client px. */
function centreOf(n: PadNode): Point {
  const r = n.svg.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** The pad's circle is drawn thicker while it aims (attributes only, nothing is rebuilt). */
function setThick(n: PadNode, on: boolean): void {
  if (n.thick === on) return;
  n.thick = on;
  n.circles.forEach((c, i) => {
    if (on) c.setAttribute('stroke-width', i === 0 ? '2.8' : '1.8');
    else if (i === 0) c.removeAttribute('stroke-width');
    else c.setAttribute('stroke-width', '0.9');
  });
}

/** The aim a release at the pointer would fire; null = the pointer is back over the pad: cancel. */
function aimAt(slot: number, n: PadNode, x: number, y: number): Aim | null {
  const sk = skillOf(slot);
  const pad = centreOf(n);
  const pointer = { x, y };
  if (isCancel(pointer, pad)) return null;
  const s = trackedRun();
  if (!sk || !s || sk.aim === 'auto') return AUTO_AIM;
  return dragToAim(sk.aim, pad, pointer, s.player, reachOf(s, sk));
}

/** Put the preview of pad `slot` on the page, or take it away. Only the pad that was pressed last draws. */
function show(slot: number, n: PadNode, emit: boolean): void {
  const pr = n.press;
  const sk = skillOf(slot);
  const s = trackedRun();
  if (drawer !== slot) return;
  if (!pr || !sk || !s || sk.aim === 'auto' || s.status !== 'running' || s.phase !== 'run' || (s.hero.cd[s.hero.pads[slot as PadSlot]] ?? 0) > 0) {
    hideAim();
    setThick(n, false);
    return;
  }
  let aim: Aim | null = null;
  if (pr.aiming) aim = aimAt(slot, n, pr.x, pr.y);
  else if (performance.now() - pr.t0 >= TAP_MS) aim = AUTO_AIM; // held still: show what a tap would do
  setThick(n, pr.aiming && aim !== null);
  showAim(aim ? previewOf(s, sk, aim) : null);
  if (emit && aim) {
    const r = resolveAim(s, sk, aim);
    busRef?.emit('skill:aim', { slot: slot as 0 | 1 | 2, mode: r.kind, x: r.x, y: r.y, dx: r.dx, dy: r.dy });
  }
}

/** While a pad is held the preview follows the hero (the other thumb may be steering). */
function tick(): void {
  frame = 0;
  let any = false;
  nodes.forEach((n, i) => {
    if (!n.press) return;
    any = true;
    show(i, n, false);
  });
  if (any) frame = requestAnimationFrame(tick);
}

/** A finger landed on skill pad `slot`. False when the pad is not a skill pad or already held. */
function press(slot: number, id: number, x: number, y: number): boolean {
  const n = nodes[slot];
  if (!n || slot > 2 || n.press) return false;
  n.press = { id, sx: x, sy: y, x, y, t0: performance.now(), aiming: false };
  n.pressedAt = performance.now();
  if (skillOf(slot)?.aim !== 'auto') {
    if (drawer !== null && drawer !== slot) hideAim();
    drawer = slot;
  }
  if (frame === 0) frame = requestAnimationFrame(tick);
  return true;
}

/** The finger moved. Beyond DRAG_START_PX a skill with an aim mode starts aiming; an auto skill ignores the drag. */
function drag(slot: number, x: number, y: number): void {
  const n = nodes[slot];
  const pr = n?.press;
  if (!n || !pr) return;
  pr.x = x;
  pr.y = y;
  if (!pr.aiming && skillOf(slot)?.aim !== 'auto' && Math.hypot(x - pr.sx, y - pr.sy) > DRAG_START_PX) pr.aiming = true;
  if (pr.aiming) show(slot, n, true);
}

/** Emit the cast with its aim (the pad's event carries none: aim.ts hands it over). */
function fire(slot: number, aim: Aim): void {
  const ev = EVENT[PADS[slot] ?? 'skill1'];
  queueAim(slot, aim);
  try {
    busRef?.emit(ev);
  } finally {
    clearQueuedAim();
  }
}

/** The finger lifted (commit) or the press was broken off. Returns true when a cast was asked for. */
function release(slot: number, x: number, y: number, commit: boolean): boolean {
  const n = nodes[slot];
  const pr = n?.press;
  if (!n || !pr) return false;
  n.press = null;
  n.pressedAt = performance.now();
  if (drawer === slot) {
    hideAim();
    drawer = null;
  }
  setThick(n, false);
  if (!commit) return false;
  let aim: Aim = AUTO_AIM;
  if (pr.aiming) {
    const a = aimAt(slot, n, x, y);
    if (!a) return false; // dragged back onto the pad: cancelled, no cooldown is spent
    aim = a;
  }
  fire(slot, aim);
  return true;
}

/** Test hook: hold skill pad `slot` (1..3) with the finger dragged (dx, dy) css px from the pad's centre. (0, 0) is back on the pad. */
export function holdPad(slot: 1 | 2 | 3, dx: number, dy: number): void {
  const i = slot - 1;
  const n = nodes[i];
  if (!n) return;
  const c = centreOf(n);
  if (!n.press) press(i, -1, c.x, c.y);
  drag(i, c.x + dx, c.y + dy);
}

/** Test hook: lift the finger held by `holdPad`. True when the release asked for a cast (false: cancelled or nothing held). */
export function releasePad(slot: 1 | 2 | 3): boolean {
  const n = nodes[slot - 1];
  const pr = n?.press;
  if (!n || !pr) return false;
  return release(slot - 1, pr.x, pr.y, true);
}

/** Three skill buttons and the inventory button: circled margin notes with a word label. */
export function createPads(root: HTMLElement, bus: Bus): HTMLElement {
  const wrap = h('div', 'pads');
  const rng = createRng(77);
  nodes.length = 0;
  currentHero = null;
  busRef = bus;
  drawer = null;
  PADS.forEach((id) => {
    const btn = h('button', `pad ${SLOT_CLASS[id]}`);
    btn.type = 'button';
    const word = h('span', 'word', id === 'inventory' ? t('ui.pads.inventory') : '');
    const svg = el('svg', { viewBox: '-26 -26 52 52' });
    const base = el('g', { class: 'base' });
    base.append(
      el('path', { d: wobblyCircle(rng, 0, 0, 23, 11, 0.03) }),
      el('path', { d: wobblyCircle(rng, 0.6, -0.4, 21.4, 9, 0.035), 'stroke-width': 0.9 }),
    );
    const glyph = el('g', { class: 'glyph' });
    if (id === 'inventory') glyph.append(el('path', { d: INVENTORY_DRAWING }));
    const ring = el('path', { class: 'cd', d: wobblyCircle(rng, 0, 0, 25.4, 12, 0.012), pathLength: 100 });
    ring.style.strokeDasharray = '100';
    svg.append(base, glyph, ring);
    btn.append(svg, word);
    if (id === 'inventory') btn.setAttribute('aria-label', t('ui.pads.inventory'));
    const slot = PADS.indexOf(id);
    if (id === 'inventory') {
      btn.addEventListener('click', () => bus.emit(EVENT[id]));
    } else {
      // A tap casts on release: the press may turn into an aimed cast (hold and drag, DESIGN 5.6). The pad follows its own
      // pointer id, so a second thumb on the joystick or on another pad is not disturbed. A `click` that follows a press is
      // swallowed; one that comes alone (keyboard, assistive tech, a script) still casts, as a tap.
      btn.style.touchAction = 'none';
      btn.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        if (!press(slot, ev.pointerId, ev.clientX, ev.clientY)) return;
        const n = nodes[slot];
        if (!n) return;
        try {
          btn.setPointerCapture(ev.pointerId);
        } catch {
          // capture is a nicety; the window listeners below hear the pointer anyway
        }
        const done = (commit: boolean) => (e: PointerEvent): void => {
          if (e.pointerId !== ev.pointerId) return;
          n.release?.();
          release(slot, e.clientX, e.clientY, commit);
        };
        const onMove = (e: PointerEvent): void => {
          if (e.pointerId === ev.pointerId) drag(slot, e.clientX, e.clientY);
        };
        const onUp = done(true);
        const onCancel = done(false);
        const onBlur = (): void => {
          n.release?.();
          release(slot, ev.clientX, ev.clientY, false);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('blur', onBlur);
        n.release = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
          window.removeEventListener('blur', onBlur);
          n.release = null;
        };
      });
      btn.addEventListener('click', () => {
        if (performance.now() - (nodes[slot]?.pressedAt ?? -Infinity) < CLICK_AFTER_PRESS_MS) return;
        fire(slot, AUTO_AIM);
      });
    }
    wrap.append(btn);
    nodes.push({ btn, svg, glyph, word, ring, circles: [...base.querySelectorAll('path')], thick: false, last: -2, press: null, release: null, pressedAt: -Infinity });
  });
  root.append(wrap);
  setPadHero(DEFAULT_HERO_ID);
  return wrap;
}
