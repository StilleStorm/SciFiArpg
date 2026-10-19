/**
 * Damage numbers (PLAN 8), off unless the setting is on: small handwritten digits in the margin beside the hit, drifting up a
 * little and fading. A fixed pool of nodes, no allocation per hit. Ink colour; only a crit is underlined, in the red accent.
 */
import type { Bus } from '../core/events';
import { el, n2 } from './svg';
import { tween } from './tween';

const POOL = 10;
const LIFE_MS = 900;
const RISE = 14;
const SIDE = 30;

interface Slot {
  g: SVGGElement;
  text: SVGTextElement;
  under: SVGPathElement;
  gen: number;
}

let pool: Slot[] = [];
let next = 0;
let host: SVGGElement | null = null;
let group: SVGGElement | null = null;

export function initDamageNumbers(layer: SVGGElement): void {
  const g = el('g', { class: 'dmg-layer', 'aria-hidden': 'true' });
  layer.append(g);
  host = layer;
  group = g;
  pool = [];
  next = 0;
  for (let i = 0; i < POOL; i++) {
    const node = el('g', { class: 'dmg' });
    node.style.opacity = '0';
    const text = el('text', { class: 't-dmg', 'text-anchor': 'middle' });
    const under = el('path', { class: 'dmg-under', fill: 'none' });
    node.append(text, under);
    g.append(node);
    pool.push({ g: node, text, under, gen: 0 });
  }
}

/** Show `amount` beside (x, y). Reuses the oldest slot when all are busy. */
export function showDamage(amount: number, x: number, y: number, crit: boolean, flip = false): void {
  const slot = pool[next];
  if (!slot) return;
  if (group && host && !group.isConnected) host.append(group); // a page turn clears the ink layer
  next = (next + 1) % pool.length;
  const value = String(Math.max(1, Math.round(amount)));
  const gen = ++slot.gen;
  const bx = x + (flip ? -SIDE : SIDE);
  const by = y - 12;
  slot.text.textContent = value;
  slot.text.setAttribute('x', '0');
  slot.text.setAttribute('y', '0');
  slot.text.classList.toggle('crit', crit);
  const w = value.length * (crit ? 9 : 7);
  slot.under.setAttribute('d', crit ? `M${n2(-w / 2 - 1)} 3 Q0 5 ${n2(w / 2 + 1)} 2.4` : '');
  slot.g.setAttribute('transform', `translate(${n2(bx)} ${n2(by)}) rotate(${flip ? 4 : -4})`);
  slot.g.style.opacity = '1';
  tween(LIFE_MS, (p) => {
    if (slot.gen !== gen) return;
    slot.g.setAttribute('transform', `translate(${n2(bx)} ${n2(by - RISE * p)}) rotate(${flip ? 4 : -4})`);
    slot.g.style.opacity = String(p < 0.45 ? 1 : 1 - (p - 0.45) / 0.55);
  });
}

/** Hook the numbers to the hits the hero lands. `enabled` is read at each hit (the setting can change at any time). */
export function bindDamageNumbers(bus: Bus, enabled: () => boolean, viewMidX: () => number | null = () => null): void {
  bus.on('enemy:hit', (e) => {
    if (!enabled()) return;
    const mid = viewMidX();
    showDamage(e.amount, e.x, e.y, e.crit, mid !== null && e.x > mid);
  });
}
